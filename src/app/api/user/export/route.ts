/**
 * GET /api/user/export
 *
 * Returns a ZIP archive containing all user-owned data in portable formats:
 *
 *   metadata.json        – export envelope (version, timestamp, userId)
 *   profile.json         – account settings and preferences (secrets redacted)
 *   goals.json           – goals + recurring goal history
 *   streaks.json         – streak freezes, milestones, and snapshot history
 *   contributions.csv    – dated metric snapshots in CSV format
 *
 * Security guarantees
 * ────────────────────
 *  • Only the authenticated requesting user's data is ever included.
 *  • Any column whose name matches a sensitive pattern is replaced with
 *    "[REDACTED]" before it reaches the ZIP.
 *  • Rate limited to one export per hour (shared with the JSON export
 *    endpoint — both write to `data_export_audit` with action = 'export').
 *  • Every export is logged to `data_export_audit` with IP and User-Agent
 *    for forensic purposes.
 */

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPORT_VERSION = "1";

/** 1 export per hour per user (shared with /api/user/data-export). */
const RATE_LIMIT_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /api_key/i,
  /access_key/i,
  /refresh/i,
  /credential/i,
  /private/i,
  /\bauth\b/i,
  /iv$/i, // encrypted IV columns
  /hash$/i, // hashed credentials
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(key));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? "[REDACTED]" : redact(v);
    }
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Audit / rate-limit helpers  (shared table with data-export)
// ---------------------------------------------------------------------------

async function getRecentExport(userId: string): Promise<Date | null> {
  const since = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
  const { data } = await supabaseAdmin
    .from("data_export_audit")
    .select("created_at")
    .eq("user_id", userId)
    .eq("action", "export")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? new Date(data.created_at as string) : null;
}

async function writeAuditLog(
  userId: string,
  req: NextRequest,
): Promise<void> {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;
    const userAgent = req.headers.get("user-agent") ?? null;
    await supabaseAdmin.from("data_export_audit").insert({
      user_id: userId,
      action: "export",
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    // Non-fatal — audit failure must never block the export.
    console.error("[export] audit log failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Data collectors
// ---------------------------------------------------------------------------

/** Profile: account settings, preferences.  Secrets are omitted at query level. */
async function collectProfile(userId: string) {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select(
      "id, github_login, bio, is_public, leaderboard_opt_in, weekly_digest_opt_in, timezone, created_at",
    )
    .eq("id", userId)
    .single();

  const { data: linked } = await supabaseAdmin
    .from("user_github_accounts")
    .select("id, github_id, github_login, created_at")
    .eq("user_id", userId);

  const { data: webhooks } = await supabaseAdmin
    .from("webhook_configs")
    .select("id, name, url, events, is_enabled, created_at")
    .eq("user_id", userId);

  return redact({
    account: user ?? null,
    linkedAccounts: linked ?? [],
    webhooks: webhooks ?? [],
  });
}

/** Goals: current goals + historical periods for recurring goals. */
async function collectGoals(userId: string) {
  const { data: goals } = await supabaseAdmin
    .from("goals")
    .select(
      "id, title, target, current, unit, recurrence, deadline, period_start, last_synced_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // goal_history may not exist in all environments — fail gracefully.
  let history: unknown[] = [];
  try {
    const { data: h } = await supabaseAdmin
      .from("goal_history")
      .select(
        "id, goal_id, period_start, period_end, target, achieved_value, completed, created_at",
      )
      .eq("user_id", userId)
      .order("period_end", { ascending: false })
      .limit(500);
    history = h ?? [];
  } catch {
    // table may not exist in older environments
  }

  return { goals: goals ?? [], goalHistory: history };
}

/** Streaks: freezes, milestones, and metric snapshots used for streak history. */
async function collectStreaks(userId: string) {
  const { data: freezes } = await supabaseAdmin
    .from("streak_freezes")
    .select("id, freeze_date, created_at")
    .eq("user_id", userId)
    .order("freeze_date", { ascending: false });

  const { data: milestones } = await supabaseAdmin
    .from("streak_milestones")
    .select("id, streak_count, achieved_at")
    .eq("user_id", userId)
    .order("achieved_at", { ascending: false });

  const { data: snapshots } = await supabaseAdmin
    .from("metric_snapshots")
    .select("snapshot_at, streak_current, streak_longest")
    .eq("user_id", userId)
    .order("snapshot_at", { ascending: false })
    .limit(1000);

  return {
    freezes: freezes ?? [],
    milestones: milestones ?? [],
    snapshotHistory: snapshots ?? [],
  };
}

/** Contributions: metric snapshots flattened for CSV output. */
async function collectContributions(userId: string) {
  const { data: snapshots } = await supabaseAdmin
    .from("metric_snapshots")
    .select(
      "snapshot_at, total_commits, total_prs, total_issues, streak_current, streak_longest",
    )
    .eq("user_id", userId)
    .order("snapshot_at", { ascending: false })
    .limit(1000);

  return (snapshots ?? []).map((s) => ({
    snapshot_at: s.snapshot_at as string,
    total_commits: s.total_commits as number,
    total_prs: s.total_prs as number,
    total_issues: s.total_issues as number,
    streak_current: s.streak_current as number,
    streak_longest: s.streak_longest as number,
  }));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Authentication
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = user.id;

  // Rate limiting
  const lastExport = await getRecentExport(userId);
  if (lastExport) {
    const retryMs = RATE_LIMIT_MS - (Date.now() - lastExport.getTime());
    const retrySeconds = Math.ceil(retryMs / 1000);
    return NextResponse.json(
      {
        error: "Rate limit exceeded. You may export your data once per hour.",
        retryAfterSeconds: retrySeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retrySeconds) },
      },
    );
  }

  // Audit log BEFORE data collection so any crash is still recorded.
  await writeAuditLog(userId, req);

  // Collect all datasets in parallel for speed.
  const [profile, goals, streaks, contributionRows] = await Promise.all([
    collectProfile(userId),
    collectGoals(userId),
    collectStreaks(userId),
    collectContributions(userId),
  ]);

  const exportedAt = new Date().toISOString();

  const metadata = {
    version: EXPORT_VERSION,
    exportedAt,
    format: "devtrack-portable-export",
    userId,
    githubLogin: session.githubLogin ?? null,
    contents: ["metadata.json", "profile.json", "goals.json", "streaks.json", "contributions.csv"],
  };

  // Build ZIP archive in memory.
  const enc = (s: string) => strToU8(s);
  const zip = zipSync(
    {
      "metadata.json": enc(JSON.stringify(metadata, null, 2)),
      "profile.json": enc(JSON.stringify(profile, null, 2)),
      "goals.json": enc(JSON.stringify(goals, null, 2)),
      "streaks.json": enc(JSON.stringify(streaks, null, 2)),
      "contributions.csv": enc(toCsv(contributionRows)),
    },
    // Level 6 is a good balance between speed and compression ratio.
    { level: 6 },
  );

  const dateSlug = exportedAt.slice(0, 10); // YYYY-MM-DD
  const filename = `devtrack-export-${dateSlug}.zip`;

  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
