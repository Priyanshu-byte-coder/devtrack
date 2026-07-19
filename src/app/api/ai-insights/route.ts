import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { weeklyProductivityPrompt } from "@/lib/ai-prompts";
import {
  analyzePatterns,
  computeTrends,
  DeveloperMetrics,
} from "@/lib/ai-mentor";
import {
  upstashRateLimitFixedWindow,
  getUpstashConfig,
} from "@/lib/upstash-rest";
import { createMemoryFixedWindowRateLimiter } from "@/lib/rate-limit";

const AI_INSIGHTS_LIMIT = 5;
const AI_INSIGHTS_WINDOW_SECONDS = 60 * 60; // 1 hour

// In-memory fallback used only when Upstash Redis is not configured.
const memoryLimiter = createMemoryFixedWindowRateLimiter({
  windowMs: AI_INSIGHTS_WINDOW_SECONDS * 1000,
  pruneIntervalMs: AI_INSIGHTS_WINDOW_SECONDS * 1000,
  maxEntries: 10_000,
});

export const dynamic = "force-dynamic";

const VALID_INSIGHT_TYPES = new Set([
  "weekly_summary",
  "pattern",
  "recommendation",
] as const);

type InsightType = "weekly_summary" | "pattern" | "recommendation";

interface ContributionsApiResponse {
  data?: Record<string, number>;
  total?: number;
  days?: number;
}

interface PRsApiResponse {
  open?: number;
  merged?: number;
  avgReviewHours?: number;
}

interface StreakApiResponse {
  current?: number;
  longest?: number;
  totalActiveDays?: number;
}

interface RepoSummary {
  name: string;
  commits: number;
}

interface ReposApiResponse {
  repos?: RepoSummary[];
}

async function fetchJsonOrEmpty<T>(
  url: string,
  headers: HeadersInit
): Promise<T> {
  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`Metrics fetch failed: ${url}`, res.status, await res.text());
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`Metrics fetch error: ${url}`, err);
    return {} as T;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve the application user so that ai_insights rows are keyed on
  // users.id (a stable UUID with a foreign-key constraint) rather than on
  // session.githubId (a mutable external identifier with no FK). Using
  // users.id ensures rows are removed via ON DELETE CASCADE when the account
  // is deleted and prevents the orphaned-record scenario described in #1750.
  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = user.id;

  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type") ?? "weekly_summary";

  // Validate against the DB CHECK constraint allowlist so that an unrecognised
  // type fails with a clear 400 instead of a Supabase constraint-violation 500.
  if (!VALID_INSIGHT_TYPES.has(rawType as InsightType)) {
    return NextResponse.json(
      {
        error: `Invalid insight type. Must be one of: ${[
          ...VALID_INSIGHT_TYPES,
        ].join(", ")}`,
      },
      { status: 400 }
    );
  }

  const type = rawType as InsightType;

  // Check the cache before touching the rate-limit counter so that repeated
  // reads of already-generated insights never consume quota.
  const { data: cached } = await supabaseAdmin
    .from("ai_insights")
    .select("*")
    .eq("user_id", userId)
    .eq("insight_type", type)
    .gte("expires_at", new Date().toISOString())
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ data: cached.content, cached: true });
  }

  // No valid cache — enforce the rate limit only when a fresh generation is needed.
  // Use Upstash Redis when configured (durable across serverless cold starts);
  // fall back to an in-memory limiter for local development without Redis.
  let rateLimitDenied = false;
  let retryAfterSeconds = AI_INSIGHTS_WINDOW_SECONDS;

  if (getUpstashConfig()) {
    const result = await upstashRateLimitFixedWindow({
      key: `ai-insights:${userId}`,
      limit: AI_INSIGHTS_LIMIT,
      windowSeconds: AI_INSIGHTS_WINDOW_SECONDS,
    });

    if (!result.allowed) {
      rateLimitDenied = true;
      retryAfterSeconds = result.retryAfter ?? AI_INSIGHTS_WINDOW_SECONDS;
    }
  } else {
    const result = memoryLimiter.check(
      `ai-insights:${userId}`,
      AI_INSIGHTS_LIMIT
    );

    if (!result.allowed) {
      rateLimitDenied = true;
      retryAfterSeconds = Math.max(
        result.reset - Math.floor(Date.now() / 1000),
        1
      );
    }
  }

  if (rateLimitDenied) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const cookie = request.headers.get("cookie") ?? "";
  const headers = { Cookie: cookie };

  const [contributionsRaw, prsRaw, streakRaw, reposRaw]: [
    ContributionsApiResponse,
    PRsApiResponse,
    StreakApiResponse,
    ReposApiResponse,
  ] = await Promise.all([
    fetchJsonOrEmpty<ContributionsApiResponse>(
      `${baseUrl}/api/metrics/contributions?days=90`,
      headers
    ),
    fetchJsonOrEmpty<PRsApiResponse>(
      `${baseUrl}/api/metrics/prs`,
      headers
    ),
    fetchJsonOrEmpty<StreakApiResponse>(
      `${baseUrl}/api/metrics/streak`,
      headers
    ),
    fetchJsonOrEmpty<ReposApiResponse>(
      `${baseUrl}/api/metrics/repos?days=90`,
      headers
    ),
  ]);

  const commitsByDay: Record<string, number> = contributionsRaw.data ?? {};
  const commitsArray = Object.entries(commitsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const metrics: DeveloperMetrics = {
    commits: commitsArray,
    prs: {
      merged: prsRaw.merged ?? 0,
      open: prsRaw.open ?? 0,
      avgMergeTimeDays: (prsRaw.avgReviewHours ?? 0) / 24,
    },
    streak: {
      current: streakRaw.current ?? 0,
      longest: streakRaw.longest ?? 0,
      activeDays: streakRaw.totalActiveDays ?? 0,
    },
    repos: (reposRaw.repos ?? []).map((r) => ({
      name: r.name,
      commits: r.commits,
    })),
  };

  const insights = analyzePatterns(metrics);
  const trend = computeTrends(metrics);

  let aiSummary: string | null = null;

  if (type === "weekly_summary" && process.env.GROQ_API_KEY) {
    try {
      const topRepoName = metrics.repos[0]?.name ?? "unknown";
      const totalCommits = metrics.commits.reduce((s, d) => s + d.count, 0);
      const trendLabel =
        trend.direction === "up"
          ? `+${trend.percentage}%`
          : `-${trend.percentage}%`;

      const prompt = weeklyProductivityPrompt({
        activeDays: metrics.streak.activeDays,
        currentStreak: metrics.streak.current,
        totalCommits,
        prsMerged: metrics.prs.merged,
        prsOpen: metrics.prs.open,
        avgMergeTimeDays: metrics.prs.avgMergeTimeDays,
        topRepoName,
        trendLabel,
      });

      const groqRes = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          }),
        }
      );

      if (groqRes.ok) {
        const groqData = (await groqRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        aiSummary = groqData.choices?.[0]?.message?.content ?? null;
      } else {
        console.error("Groq API error", groqRes.status, await groqRes.text());
      }
    } catch (err) {
      console.error("Groq API error — falling back to rule-based summary", err);
    }
  }

  const payload = {
    insights,
    trend,
    aiSummary,
    generatedAt: new Date().toISOString(),
  };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await supabaseAdmin.from("ai_insights").upsert(
    {
      user_id: userId,
      insight_type: type,
      content: payload,
      generated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "user_id,insight_type" }
  );

  return NextResponse.json({ data: payload, cached: false });
}
