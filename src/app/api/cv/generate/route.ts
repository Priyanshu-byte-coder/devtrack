import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  ContributionClassification,
  CVGenerateRequest,
  CVGenerateResponse,
  ResumeContent,
} from "@/types/cv-types";

export const dynamic = "force-dynamic";

/** In-memory rate-limit tracker – 5 requests per hour per user. */
const generateRateLimit = new Map<
  string,
  { count: number; resetTime: number }
>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = process.env.NODE_ENV === "development" ? 100 : 5;

/**
 * POST /api/cv/generate
 *
 * Generates role-tailored resume content from a previously cached analysis.
 * Request body: `{ role: string }`
 */
export async function POST(request: Request) {
  try {
    /* ── 1. Auth ─────────────────────────────────────────────── */
    const session = await getServerSession(authOptions);

    if (!session?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.githubId;

    /* ── 2. Rate limiting ────────────────────────────────────── */
    const currentTime = Date.now();

    let existing = generateRateLimit.get(userId);
    if (!existing || currentTime > existing.resetTime) {
      existing = { count: 0, resetTime: currentTime + WINDOW_MS };
      generateRateLimit.set(userId, existing);
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

    /* ── 3. Parse request body ───────────────────────────────── */
    const body = (await request.json()) as CVGenerateRequest;
    const role = body.role?.trim();

    if (!role) {
      return NextResponse.json(
        { error: "Missing required field: role" },
        { status: 400 }
      );
    }

    /* ── 4. Load cached analysis ─────────────────────────────── */
    const { data: analysisRow } = await supabaseAdmin
      .from("cv_analyses")
      .select("analysis_data")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!analysisRow) {
      return NextResponse.json(
        { error: "No analysis found. Run /api/cv/analyze first." },
        { status: 404 }
      );
    }

    const analysis = analysisRow.analysis_data as ContributionClassification;

    /* ── 5. Check for cached generation for this role ────────── */
    const { data: cachedContent } = await supabaseAdmin
      .from("cv_generated_content")
      .select("content")
      .eq("user_id", userId)
      .eq("role", role)
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (cachedContent) {
      const response: CVGenerateResponse = {
        content: cachedContent.content as ResumeContent,
        cached: true,
      };
      return NextResponse.json(response);
    }

    /* ── 6. Generate resume content ──────────────────────────── */
    const { generateResumeContent } = await import(
      "@/lib/cv/cv-ai-generator"
    );

    const content = await generateResumeContent(analysis, role);

    /* ── 7. Cache in Supabase ────────────────────────────────── */
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await supabaseAdmin.from("cv_generated_content").upsert(
      {
        user_id: userId,
        role,
        content,
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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
