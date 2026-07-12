import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/get-session-token";
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
const MAX_REQUESTS = 3;

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
  const accessToken = await getAccessToken();

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

    /* ── 4. Fetch & classify ─────────────────────────────────── */
    const { fetchContributionData } = await import(
      "@/lib/cv/cv-github-fetcher"
    );
    const { classifyContributions } = await import(
      "@/lib/cv/cv-classifier"
    );

    const contributionData = await fetchContributionData(
      accessToken as string,
      session.githubId
    );

    const analysis = classifyContributions(contributionData);

    /* ── 5. Cache in Supabase (24 h TTL) ─────────────────────── */
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await supabaseAdmin.from("cv_analyses").upsert(
      {
        user_id: userId,
        analysis_data: analysis,
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "user_id" }
    );

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
