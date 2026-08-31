/**
 * POST /api/ai/weekly-summary
 *
 * Generates a personalised 2–3 sentence weekly coding summary using the
 * Anthropic API.  The caller supplies aggregated weekly metrics in the
 * request body; this route validates them, enforces a per-user rate limit
 * of one generation per 24-hour window, calls the AI service, and returns
 * the summary text.
 *
 * Security
 * --------
 * - Session required — unauthenticated requests are rejected with 401.
 * - ANTHROPIC_API_KEY is read only on the server; it never appears in any
 *   response or client-accessible bundle.
 * - Metrics are validated server-side before the prompt is built.
 * - String fields (topRepo) are truncated to prevent over-long inputs.
 * - Rate limit is enforced server-side via users.last_ai_summary_at.
 *
 * Rate limit
 * ----------
 * Maximum one generated summary per user per 24-hour rolling window.
 * The timestamp of the last generation is stored in users.last_ai_summary_at
 * and updated atomically after a successful generation.  A 429 response
 * includes a Retry-After header (seconds until the window resets) and a
 * human-readable rateLimitReset field in the body.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { generateWeeklySummary, type WeeklyMetrics } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

// ── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_REPO_NAME_LENGTH = 200; // guard against oversized string inputs

// ── Input validation ─────────────────────────────────────────────────────────

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

interface ValidationResult {
  valid: true;
  metrics: WeeklyMetrics;
}
interface ValidationError {
  valid: false;
  message: string;
}

function validateBody(body: unknown): ValidationResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { valid: false, message: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  // commits
  const commits = b.commits as Record<string, unknown> | undefined;
  if (!commits || typeof commits !== "object") {
    return { valid: false, message: "Missing or invalid field: commits" };
  }
  if (
    !isNonNegativeInt(commits.current) ||
    !isNonNegativeInt(commits.previous) ||
    typeof commits.delta !== "number" ||
    !Number.isInteger(commits.delta) ||
    !["up", "down", "same"].includes(commits.trend as string)
  ) {
    return { valid: false, message: "Invalid commits fields" };
  }

  // prs
  const prs = b.prs as Record<string, unknown> | undefined;
  if (!prs || typeof prs !== "object") {
    return { valid: false, message: "Missing or invalid field: prs" };
  }
  const thisWeek = prs.thisWeek as Record<string, unknown> | undefined;
  const lastWeek = prs.lastWeek as Record<string, unknown> | undefined;
  if (
    !thisWeek ||
    !lastWeek ||
    !isNonNegativeInt(thisWeek.opened) ||
    !isNonNegativeInt(thisWeek.merged) ||
    !isNonNegativeInt(lastWeek.opened) ||
    !isNonNegativeInt(lastWeek.merged)
  ) {
    return { valid: false, message: "Invalid prs fields" };
  }

  // streak
  if (!isNonNegativeInt(b.streak)) {
    return { valid: false, message: "Missing or invalid field: streak" };
  }

  // activeDays
  const activeDays = b.activeDays as Record<string, unknown> | undefined;
  if (
    !activeDays ||
    !isNonNegativeInt(activeDays.thisWeek) ||
    !isNonNegativeInt(activeDays.lastWeek)
  ) {
    return { valid: false, message: "Invalid activeDays fields" };
  }

  // topRepo (nullable string)
  const topRepo = b.topRepo;
  if (topRepo !== null && typeof topRepo !== "string") {
    return { valid: false, message: "Invalid topRepo: must be a string or null" };
  }

  return {
    valid: true,
    metrics: {
      commits: {
        current: commits.current as number,
        previous: commits.previous as number,
        delta: commits.delta as number,
        trend: commits.trend as "up" | "down" | "same",
      },
      prs: {
        thisWeek: {
          opened: thisWeek.opened as number,
          merged: thisWeek.merged as number,
        },
        lastWeek: {
          opened: lastWeek.opened as number,
          merged: lastWeek.merged as number,
        },
      },
      streak: b.streak as number,
      topRepo:
        typeof topRepo === "string"
          ? topRepo.slice(0, MAX_REPO_NAME_LENGTH)
          : null,
      activeDays: {
        thisWeek: activeDays.thisWeek as number,
        lastWeek: activeDays.lastWeek as number,
      },
    },
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Resolve application user (stable UUID required for DB operations)
  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 3. Rate limit check — read last_ai_summary_at from users table
  const { data: userRow, error: userError } = await supabaseAdmin
    .from("users")
    .select("last_ai_summary_at")
    .eq("id", user.id)
    .single();

  if (userError) {
    console.error("[ai/weekly-summary] Failed to fetch user row:", userError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  if (userRow?.last_ai_summary_at) {
    const lastAt = new Date(userRow.last_ai_summary_at).getTime();
    const elapsed = Date.now() - lastAt;
    if (elapsed < RATE_LIMIT_MS) {
      const resetAt = new Date(lastAt + RATE_LIMIT_MS);
      const retryAfterSeconds = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: "Rate limit exceeded: one AI summary per 24 hours",
          rateLimitReset: resetAt.toISOString(),
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
      );
    }
  }

  // 4. Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const validation = validateBody(rawBody);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  // 5. Generate AI summary
  const summary = await generateWeeklySummary(validation.metrics);

  if (!summary) {
    // Anthropic unavailable — return a clear, non-blocking error so the UI
    // can show a helpful message without crashing.
    return NextResponse.json(
      { error: "AI summary service is temporarily unavailable" },
      { status: 503 }
    );
  }

  // 6. Persist rate-limit timestamp (fire-and-forget; non-fatal on failure)
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ last_ai_summary_at: now })
    .eq("id", user.id);

  if (updateError) {
    // Not fatal — the summary is returned regardless.
    console.error(
      "[ai/weekly-summary] Failed to update last_ai_summary_at:",
      updateError
    );
  }

  const resetAt = new Date(Date.now() + RATE_LIMIT_MS);

  return NextResponse.json({
    summary,
    generatedAt: now,
    rateLimitReset: resetAt.toISOString(),
  });
}
