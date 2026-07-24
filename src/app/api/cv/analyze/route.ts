import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { ContributionClassification, CVAnalyzeResponse } from "@/types/cv-types";

export const dynamic = "force-dynamic";

/** In-memory rate-limit tracker – 3 requests per hour per user. */
const analyzeRateLimit = new Map<
  string,
  { count: number; resetTime: number }
>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = process.env.NODE_ENV === "development" ? 100 : 3;

/**
 * Resolves the GitHub login string for the current session.
 * Falls back to calling GET /user if the session's githubLogin is absent
 * or looks like a stale/numeric value (e.g. "219068160").
 */
async function resolveGitHubLogin(
  sessionLogin: string | undefined | null,
  accessToken: string
): Promise<string> {
  // Valid login: non-empty and not purely numeric
  if (sessionLogin && !/^\d+$/.test(sessionLogin)) {
    return sessionLogin;
  }
  // Fallback: resolve via GitHub REST API
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve GitHub login: ${res.status}`);
  }
  const data = (await res.json()) as { login: string };
  return data.login;
}

/**
 * POST /api/cv/analyze
 *
 * Fetches and classifies the authenticated user's GitHub contributions.
 * Returns a cached result when available (24 h TTL).
 */
export async function POST() {
  try {
    /* ── 1. Auth ─────────────────────────────────────────────── */
    const session = await getServerSession(authOptions);

    if (!session?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.githubId;

    /* ── 2. Rate limiting ────────────────────────────────────── */
    const currentTime = Date.now();

    let existing = analyzeRateLimit.get(userId);
    if (!existing || currentTime > existing.resetTime) {
      existing = { count: 0, resetTime: currentTime + WINDOW_MS };
      analyzeRateLimit.set(userId, existing);
    }

    if (existing.count >= MAX_REQUESTS) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((existing.resetTime - currentTime) / 1000)
            ),
          },
        }
      );
    }
    existing.count += 1;

    /* ── 3. Cache check ──────────────────────────────────────── */
    const { data: cached } = await supabaseAdmin
      .from("cv_analyses")
      .select("*")
      .eq("user_id", userId)
      .gte("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      const response: CVAnalyzeResponse = {
        analysis: cached.analysis_data as ContributionClassification,
        cached: true,
      };
      return NextResponse.json(response);
    }

    /* ── 4. Resolve login & fetch contributions ───────────────── */
    const accessToken = session.accessToken as string;
    const githubLogin = await resolveGitHubLogin(
      session.githubLogin as string | undefined,
      accessToken
    );

    const { fetchContributionData } = await import(
      "@/lib/cv/cv-github-fetcher"
    );
    const { classifyContributions } = await import(
      "@/lib/cv/cv-classifier"
    );

    const contributionData = await fetchContributionData(accessToken, githubLogin);
    const analysis = classifyContributions(contributionData);

    /* ── 5. Cache in Supabase (24 h TTL) — non-fatal ─────────── */
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { error: upsertError } = await supabaseAdmin.from("cv_analyses").upsert(
      {
        user_id: userId,
        analysis_data: analysis,
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      // Log but don't fail — analysis is computed, just not cached.
      console.warn(
        "CV analyze: Supabase cache upsert failed (non-fatal):",
        upsertError.message
      );
    }

    /* ── 6. Respond ──────────────────────────────────────────── */
    const response: CVAnalyzeResponse = { analysis, cached: false };
    return NextResponse.json(response);
  } catch (err) {
    console.error("CV analyze error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
