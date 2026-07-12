/**
 * GET  /api/user/github-orgs
 *   Returns the authenticated user's GitHub organizations merged with their
 *   stored metric-inclusion preferences.  On first call the org list is
 *   fetched live from the GitHub API and upserted into user_github_orgs;
 *   subsequent calls return the stored record (refreshed when the GitHub
 *   list is fetched).
 *
 * PATCH /api/user/github-orgs
 *   Updates the include_in_metrics preference for a single organization.
 *   Body: { orgId: string; includeInMetrics: boolean }
 *
 * Requires the read:org OAuth scope for full private-membership visibility.
 * Without it the GitHub API returns only public memberships (no error), so
 * the endpoint degrades gracefully rather than failing.
 */

import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { type NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { fetchUserOrgs } from "@/lib/github-orgs";

export const dynamic = "force-dynamic";

interface OrgRow {
  org_id: string;
  org_login: string;
  avatar_url: string | null;
  include_in_metrics: boolean;
}

export interface OrgRecord {
  orgId: string;
  orgLogin: string;
  avatarUrl: string | null;
  includeInMetrics: boolean;
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!session?.githubId || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch live org list from GitHub (graceful on missing read:org scope).
  const githubOrgs = await fetchUserOrgs(accessToken);

  // Upsert discovered orgs into the preference table so users can control
  // per-org inclusion.  Existing rows keep their include_in_metrics value.
  if (githubOrgs.length > 0) {
    const now = new Date().toISOString();
    const upsertRows = githubOrgs.map((org) => ({
      user_id: user.id,
      org_id: String(org.id),
      org_login: org.login,
      avatar_url: org.avatar_url ?? null,
      updated_at: now,
    }));

    await supabaseAdmin
      .from("user_github_orgs")
      .upsert(upsertRows, {
        onConflict: "user_id,org_id",
        ignoreDuplicates: false,
      })
      .select("id");
    // Errors are swallowed intentionally — a failed upsert does not prevent
    // returning the live GitHub data to the client.
  }

  // Fetch stored preferences (may include previously discovered orgs no
  // longer returned by GitHub, e.g. if the user left an org).
  const { data: stored, error: fetchErr } = await supabaseAdmin
    .from("user_github_orgs")
    .select("org_id, org_login, avatar_url, include_in_metrics")
    .eq("user_id", user.id)
    .order("org_login", { ascending: true });

  if (fetchErr) {
    return NextResponse.json(
      { error: "Failed to load org preferences" },
      { status: 500 }
    );
  }

  const orgs: OrgRecord[] = (stored ?? []).map((row: OrgRow) => ({
    orgId: row.org_id,
    orgLogin: row.org_login,
    avatarUrl: row.avatar_url,
    includeInMetrics: row.include_in_metrics,
  }));

  // Indicate when the GitHub API returned no results so the client can
  // differentiate "user has no orgs" from "scope not granted yet".
  const hasReadOrgScope = githubOrgs.length > 0 || orgs.length === 0;

  return NextResponse.json({ orgs, hasReadOrgScope });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, includeInMetrics } = body as Record<string, unknown>;

  if (typeof orgId !== "string" || orgId.trim().length === 0) {
    return NextResponse.json(
      { error: "orgId must be a non-empty string" },
      { status: 400 }
    );
  }

  if (typeof includeInMetrics !== "boolean") {
    return NextResponse.json(
      { error: "includeInMetrics must be a boolean" },
      { status: 400 }
    );
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("user_github_orgs")
    .update({
      include_in_metrics: includeInMetrics,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("org_id", orgId.trim());

  if (error) {
    return NextResponse.json(
      { error: "Failed to update org preference" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
