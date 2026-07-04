import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { goalMentorPrompt, GoalMentorPromptParams } from "@/lib/ai-prompts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  upstashRateLimitFixedWindow,
  getUpstashConfig,
} from "@/lib/upstash-rest";
import { createMemoryFixedWindowRateLimiter } from "@/lib/rate-limit";

const MENTOR_INSIGHT_TYPE = "goal_suggestions";
const MENTOR_LIMIT = 5;
const MENTOR_WINDOW_SECONDS = 60 * 60; // 1 hour
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const memoryLimiter = createMemoryFixedWindowRateLimiter({
  windowMs: MENTOR_WINDOW_SECONDS * 1000,
  pruneIntervalMs: MENTOR_WINDOW_SECONDS * 1000,
  maxEntries: 10_000,
});

export const dynamic = "force-dynamic";

interface GoalSuggestion {
  title: string;
  target: number;
  unit: string;
  recurrence: string;
  reasoning: string;
}

interface MentorSuggestionsResponse {
  suggestions: GoalSuggestion[];
}

function parseJsonSuggestions(raw: string): MentorSuggestionsResponse | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.suggestions)) return null;

    const validated = parsed.suggestions.map((s: any) => ({
      title: String(s.title || "").slice(0, 100),
      target: Number(s.target || 1),
      unit: String(s.unit || "commits"),
      recurrence: String(s.recurrence || "weekly"),
      reasoning: String(s.reasoning || ""),
    }));

    return { suggestions: validated };
  } catch {
    return null;
  }
}

function getStaticFallbackSuggestions(topRepo: string, languages: string[]): MentorSuggestionsResponse {
  const primaryLang = languages[0] || "coding";
  return {
    suggestions: [
      {
        title: `Make 10 commits in ${topRepo}`,
        target: 10,
        unit: "commits",
        recurrence: "weekly",
        reasoning: "A steady target of 10 commits this week will help maintain development momentum."
      },
      {
        title: `Work for 5 hours on ${primaryLang} tasks`,
        target: 5,
        unit: "hours",
        recurrence: "weekly",
        reasoning: "Spending focused hours writing code builds mastery in your core programming language."
      },
      {
        title: `Merge 2 Pull Requests`,
        target: 2,
        unit: "prs",
        recurrence: "weekly",
        reasoning: "Setting a goal to merge PRs encourages you to wrap up features and keep branches clean."
      }
    ]
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = user.id;
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  // 1. Check cache first
  if (!forceRefresh) {
    const { data: cached } = await supabaseAdmin
      .from("ai_insights")
      .select("*")
      .eq("user_id", userId)
      .eq("insight_type", MENTOR_INSIGHT_TYPE)
      .gte("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({ data: cached.content, cached: true });
    }
  }

  // 2. Enforce rate limiting
  let rateLimitDenied = false;
  let retryAfterSeconds = MENTOR_WINDOW_SECONDS;

  if (getUpstashConfig()) {
    const result = await upstashRateLimitFixedWindow({
      key: `mentor:${userId}`,
      limit: MENTOR_LIMIT,
      windowSeconds: MENTOR_WINDOW_SECONDS,
    });
    if (!result.allowed) {
      rateLimitDenied = true;
      retryAfterSeconds = result.retryAfter ?? MENTOR_WINDOW_SECONDS;
    }
  } else {
    const result = memoryLimiter.check(`mentor:${userId}`, MENTOR_LIMIT);
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

  // 3. Fetch recent metrics to supply context to the LLM
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const cookie = request.headers.get("cookie") ?? "";
  const headers = { Cookie: cookie };

  let contributionsRaw: any = {};
  let prsRaw: any = {};
  let streakRaw: any = {};
  let reposRaw: any = {};
  let languagesRaw: any = {};

  try {
    const [contributionsRes, prsRes, streakRes, reposRes, languagesRes] = await Promise.all([
      fetch(`${baseUrl}/api/metrics/contributions?days=30`, { headers, cache: "no-store" }),
      fetch(`${baseUrl}/api/metrics/prs`, { headers, cache: "no-store" }),
      fetch(`${baseUrl}/api/metrics/streak`, { headers, cache: "no-store" }),
      fetch(`${baseUrl}/api/metrics/repos?days=30`, { headers, cache: "no-store" }),
      fetch(`${baseUrl}/api/metrics/languages?days=30`, { headers, cache: "no-store" }),
    ]);

    contributionsRaw = contributionsRes.ok ? await contributionsRes.json() : {};
    prsRaw = prsRes.ok ? await prsRes.json() : {};
    streakRaw = streakRes.ok ? await streakRes.json() : {};
    reposRaw = reposRes.ok ? await reposRes.json() : {};
    languagesRaw = languagesRes.ok ? await languagesRes.json() : {};
  } catch (err) {
    console.error("Failed to fetch metrics for AI Mentor:", err);
  }

  const commitsByDay: Record<string, number> = contributionsRaw.data ?? {};
  const totalCommits = Object.values(commitsByDay).reduce((s, c) => s + c, 0);
  const activeDays = streakRaw.totalActiveDays ?? 0;
  const longestStreak = streakRaw.longest ?? 0;
  const prsMerged = prsRaw.merged ?? 0;
  const topRepoName = reposRaw.repos?.[0]?.name ?? "your repositories";
  const repoCount = reposRaw.repos?.length ?? 0;
  const languagesList = Array.isArray(languagesRaw.languages)
    ? languagesRaw.languages.map((l: any) => l.name)
    : [];

  const promptParams: GoalMentorPromptParams = {
    totalCommits,
    activeDays,
    longestStreak,
    prsMerged,
    topRepoName,
    repoCount,
    languages: languagesList.length > 0 ? languagesList : ["coding"],
  };

  let report: MentorSuggestionsResponse = getStaticFallbackSuggestions(topRepoName, languagesList);
  let resolvedSource = "fallback";

  // 4. Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const promptText = goalMentorPrompt(promptParams);
      const result = await model.generateContent(promptText);
      const text = result.response.text();
      const parsed = parseJsonSuggestions(text);
      if (parsed) {
        report = parsed;
        resolvedSource = "gemini";
      }
    } catch (err) {
      console.error("Gemini API error in Goal Mentor:", err);
    }
  }

  // 5. Fallback to Groq if Gemini failed or is not set
  if (resolvedSource === "fallback" && process.env.GROQ_API_KEY) {
    try {
      const promptText = goalMentorPrompt(promptParams);
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
            temperature: 0.7,
            messages: [{ role: "user", content: promptText }],
          }),
        }
      );

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const text = groqData.choices?.[0]?.message?.content || "";
        const parsed = parseJsonSuggestions(text);
        if (parsed) {
          report = parsed;
          resolvedSource = "groq";
        }
      }
    } catch (err) {
      console.error("Groq API error in Goal Mentor:", err);
    }
  }

  // 6. Cache the result in DB
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    await supabaseAdmin.from("ai_insights").upsert(
      {
        user_id: userId,
        insight_type: MENTOR_INSIGHT_TYPE,
        content: report,
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "user_id,insight_type" }
    );
  } catch (err) {
    console.error("Failed to cache goal suggestions:", err);
  }

  return NextResponse.json({ data: report, cached: false, source: resolvedSource });
}
