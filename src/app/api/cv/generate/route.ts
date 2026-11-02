import { toDatabaseJson } from "@/lib/database-json";
import { githubRequest } from "@/lib/github-request";
import { NextResponse } from "next/server";
import { getServerSession, type ServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  ContributionClassification,
  CVGenerateRequest,
  CVGenerateResponse,
  ResumeContent,
  ResumeProfile,
} from "@/types/cv-types";

export const dynamic = "force-dynamic";

/** In-memory rate-limit tracker – 5 requests per hour per user. */
const generateRateLimit = new Map<
  string,
  { count: number; resetTime: number }
>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = process.env.NODE_ENV === "development" ? 100 : 5;

function isClassification(value: unknown): value is ContributionClassification {
  const v = value as ContributionClassification | null | undefined;
  return (
    !!v &&
    Array.isArray(v.repositoryAnalyses) &&
    Array.isArray(v.domains) &&
    !!v.techStack &&
    !!v.contributionScores
  );
}

/** Contact header for the resume; never fails the generation. */
async function fetchResumeProfile(
  session: ServerSession
): Promise<ResumeProfile> {
  const fallback: ResumeProfile = {
    name: session.user?.name ?? null,
    login: session.githubLogin ?? "",
    email: session.user?.email ?? null,
    location: null,
    website: null,
  };
  if (!session.accessToken) return fallback;

  try {
    const res = await githubRequest("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const user = (await res.json()) as {
      login?: string;
      name?: string | null;
      email?: string | null;
      location?: string | null;
      blog?: string | null;
    };
    return {
      name: user.name || fallback.name,
      login: user.login || fallback.login,
      email: user.email || fallback.email,
      location: user.location || null,
      website: user.blog || null,
    };
  } catch {
    return fallback;
  }
}

/**
 * POST /api/cv/generate
 *
 * Generates role-tailored resume content from a previously cached analysis.
 * Request body: `{ role: string, regenerate?: boolean }`
 */
export async function POST(request: Request) {
  try {
    /* ── 1. Auth ─────────────────────────────────────────────── */
    const session = await getServerSession(authOptions);

    if (!session?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.githubId;

    /* ── 2. Parse request body ───────────────────────────────── */
    const body = (await request.json().catch(() => ({}))) as CVGenerateRequest;
    const role = body.role?.trim().slice(0, 80);
    const regenerate = body.regenerate === true;

    if (!role) {
      return NextResponse.json(
        { error: "Missing required field: role" },
        { status: 400 }
      );
    }

    /* ── 3. Load cached analysis ─────────────────────────────── */
    const { data: analysisRow } = await supabaseAdmin
      .from("cv_analyses")
      .select("analysis_data")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If the analysis could not be cached (the cache write is non-fatal),
    // fall back to the copy the client already holds.
    const analysis =
      (analysisRow?.analysis_data as unknown as
        ContributionClassification | undefined) ??
      (isClassification(body.analysis) ? body.analysis : null);

    if (!analysis) {
      return NextResponse.json(
        {
          error:
            "Analyze your GitHub activity first, then generate the resume.",
        },
        { status: 404 }
      );
    }

    /* ── 4. Check for cached generation for this role ────────── */
    const { data: cachedContent } = await supabaseAdmin
      .from("cv_generated_content")
      .select("content")
      .eq("user_id", userId)
      .eq("role", role)
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (cachedContent && !regenerate) {
      const cached = cachedContent.content as unknown as ResumeContent;
      const response: CVGenerateResponse = {
        content: cached.profile
          ? cached
          : { ...cached, profile: await fetchResumeProfile(session) },
        cached: true,
      };
      return NextResponse.json(response);
    }

    /* ── 5. Rate limiting (only real generations count) ─────── */
    const currentTime = Date.now();

    let existing = generateRateLimit.get(userId);
    if (!existing || currentTime > existing.resetTime) {
      existing = { count: 0, resetTime: currentTime + WINDOW_MS };
      generateRateLimit.set(userId, existing);
    }

    if (existing.count >= MAX_REQUESTS) {
      return NextResponse.json(
        {
          error: `You can generate ${MAX_REQUESTS} resumes per hour. Try again in ${Math.ceil((existing.resetTime - currentTime) / 60000)} min.`,
        },
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

    /* ── 6. Generate resume content ──────────────────────────── */
    const { generateResumeContent } = await import("@/lib/cv/cv-ai-generator");

    const [generated, profile] = await Promise.all([
      generateResumeContent(analysis, role),
      fetchResumeProfile(session),
    ]);
    const content: ResumeContent = { ...generated, profile };

    /* ── 7. Cache in Supabase ────────────────────────────────── */
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await supabaseAdmin.from("cv_generated_content").upsert(
      {
        user_id: userId,
        role,
        content: toDatabaseJson(content),
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "user_id,role" }
    );

    /* ── 8. Respond ──────────────────────────────────────────── */
    const response: CVGenerateResponse = { content, cached: false };
    return NextResponse.json(response);
  } catch (err) {
    console.error("CV generate error:", err);
    return NextResponse.json(
      {
        error:
          "Could not generate the resume right now. Please try again in a minute.",
      },
      { status: 500 }
    );
  }
}
