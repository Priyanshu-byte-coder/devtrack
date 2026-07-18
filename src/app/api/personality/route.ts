import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { personalityReportPrompt } from "@/lib/ai-prompts";
import {
    computePersonalityDimensions,
    buildFallbackReport,
    type PersonalityReport,
    type PersonalityInputMetrics,
} from "@/lib/personality-analysis";
import {
    upstashRateLimitFixedWindow,
    getUpstashConfig,
} from "@/lib/upstash-rest";
import { createMemoryFixedWindowRateLimiter } from "@/lib/rate-limit";

const PERSONALITY_INSIGHT_TYPE = "personality";
const PERSONALITY_LIMIT = 5;
const PERSONALITY_WINDOW_SECONDS = 60 * 60; // 1 hour
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours, matches ai-insights

// In-memory fallback used only when Upstash Redis is not configured.
const memoryLimiter = createMemoryFixedWindowRateLimiter({
    windowMs: PERSONALITY_WINDOW_SECONDS * 1000,
    pruneIntervalMs: PERSONALITY_WINDOW_SECONDS * 1000,
    maxEntries: 10_000,
});

export const dynamic = "force-dynamic";

interface TimeBlocksResponse {
    morning?: number;
    afternoon?: number;
    evening?: number;
    night?: number;
}

interface ContributionsApiResponse {
    data?: Record<string, number>;
    timeBlocks?: TimeBlocksResponse;
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

function parseGroqReport(raw: string): Partial<PersonalityReport> | null {
    try {
        // Groq is asked to return raw JSON, but strip code fences defensively
        // in case the model wraps its answer anyway.
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        if (
            typeof parsed.archetype !== "string" ||
            typeof parsed.tagline !== "string" ||
            typeof parsed.description !== "string" ||
            !Array.isArray(parsed.strengths) ||
            typeof parsed.funFact !== "string"
        ) {
            return null;
        }

        return {
            archetype: parsed.archetype,
            tagline: parsed.tagline,
            description: parsed.description,
            strengths: parsed.strengths.slice(0, 4).map((s: unknown) => String(s)),
            funFact: parsed.funFact,
        };
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.githubId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Keyed on the application user UUID (not session.githubId) so cached
    // rows are removed via ON DELETE CASCADE when the account is deleted —
    // same rationale as /api/ai-insights (see migration fixing ai_insights
    // ownership for the history here).
    const user = await resolveAppUser(session.githubId, session.githubLogin);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    // Check the cache before touching the rate-limit counter so repeated
    // reads of an already-generated report never consume quota.
    if (!forceRefresh) {
        const { data: cached } = await supabaseAdmin
            .from("ai_insights")
            .select("*")
            .eq("user_id", userId)
            .eq("insight_type", PERSONALITY_INSIGHT_TYPE)
            .gte("expires_at", new Date().toISOString())
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cached) {
            return NextResponse.json({ data: cached.content, cached: true });
        }
    }

    // No valid cache (or refresh requested) — enforce the rate limit only
    // when a fresh generation is actually needed.
    let rateLimitDenied = false;
    let retryAfterSeconds = PERSONALITY_WINDOW_SECONDS;

    if (getUpstashConfig()) {
        const result = await upstashRateLimitFixedWindow({
            key: `personality:${userId}`,
            limit: PERSONALITY_LIMIT,
            windowSeconds: PERSONALITY_WINDOW_SECONDS,
        });
        if (!result.allowed) {
            rateLimitDenied = true;
            retryAfterSeconds = result.retryAfter ?? PERSONALITY_WINDOW_SECONDS;
        }
    } else {
        const result = memoryLimiter.check(`personality:${userId}`, PERSONALITY_LIMIT);
        if (!result.allowed) {
            rateLimitDenied = true;
            retryAfterSeconds = Math.max(result.reset - Math.floor(Date.now() / 1000), 1);
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

    const [contributionsRes, prsRes, streakRes, reposRes] = await Promise.all([
        fetch(`${baseUrl}/api/metrics/contributions?days=90`, {
            headers,
            cache: "no-store",
        }),
        fetch(`${baseUrl}/api/metrics/prs`, { headers, cache: "no-store" }),
        fetch(`${baseUrl}/api/metrics/streak`, { headers, cache: "no-store" }),
        fetch(`${baseUrl}/api/metrics/repos?days=90`, {
            headers,
            cache: "no-store",
        }),
    ]);

    const [contributionsRaw, prsRaw, streakRaw, reposRaw]: [
        ContributionsApiResponse,
        PRsApiResponse,
        StreakApiResponse,
        ReposApiResponse,
    ] = await Promise.all([
        contributionsRes.ok ? contributionsRes.json() : {},
        prsRes.ok ? prsRes.json() : {},
        streakRes.ok ? streakRes.json() : {},
        reposRes.ok ? reposRes.json() : {},
    ]);

    const commitsByDay: Record<string, number> = contributionsRaw.data ?? {};
    const commitsArray = Object.entries(commitsByDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    const totalCommits = commitsArray.reduce((s, d) => s + d.count, 0);

    const metrics: PersonalityInputMetrics = {
        timeBlocks: {
            morning: contributionsRaw.timeBlocks?.morning ?? 0,
            afternoon: contributionsRaw.timeBlocks?.afternoon ?? 0,
            evening: contributionsRaw.timeBlocks?.evening ?? 0,
            night: contributionsRaw.timeBlocks?.night ?? 0,
        },
        totalCommits,
        activeDays: streakRaw.totalActiveDays ?? 0,
        longestStreak: streakRaw.longest ?? 0,
        currentStreak: streakRaw.current ?? 0,
        prsMerged: prsRaw.merged ?? 0,
        prsOpen: prsRaw.open ?? 0,
        avgMergeTimeDays: (prsRaw.avgReviewHours ?? 0) / 24,
        topRepoName: reposRaw.repos?.[0]?.name ?? "your top repo",
        repoCount: reposRaw.repos?.length ?? 0,
        commitsByDay: commitsArray,
    };

    const dimensions = computePersonalityDimensions(metrics);
    let report: PersonalityReport = buildFallbackReport(dimensions, {
        topRepoName: metrics.topRepoName,
        longestStreak: metrics.longestStreak,
        prsMerged: metrics.prsMerged,
    });

    if (process.env.GROQ_API_KEY) {
        try {
            const prompt = personalityReportPrompt({
                workingStyle: dimensions.workingStyle,
                commitPattern: dimensions.commitPattern,
                collaborationStyle: dimensions.collaborationStyle,
                perfectionismScore: dimensions.perfectionismScore,
                nightCommitPct: dimensions.nightCommitPct,
                morningCommitPct: dimensions.morningCommitPct,
                totalCommits: metrics.totalCommits,
                activeDays: metrics.activeDays,
                longestStreak: metrics.longestStreak,
                prsMerged: metrics.prsMerged,
                avgMergeTimeDays: metrics.avgMergeTimeDays,
                topRepoName: metrics.topRepoName,
                repoCount: metrics.repoCount,
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
                        max_tokens: 400,
                        temperature: 0.8,
                        messages: [{ role: "user", content: prompt }],
                    }),
                }
            );

            if (groqRes.ok) {
                const groqData = (await groqRes.json()) as {
                    choices?: Array<{ message?: { content?: string } }>;
                };
                const content = groqData.choices?.[0]?.message?.content;
                const parsed = content ? parseGroqReport(content) : null;

                if (parsed) {
                    report = { ...dimensions, ...parsed, source: "ai" } as PersonalityReport;
                }
            } else {
                console.error("Groq API error", groqRes.status, await groqRes.text());
            }
        } catch (err) {
            console.error("Groq API error — falling back to rule-based report", err);
        }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    await supabaseAdmin.from("ai_insights").upsert(
        {
            user_id: userId,
            insight_type: PERSONALITY_INSIGHT_TYPE,
            content: report,
            generated_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
        },
        { onConflict: "user_id,insight_type" }
    );

    return NextResponse.json({ data: report, cached: false });
}