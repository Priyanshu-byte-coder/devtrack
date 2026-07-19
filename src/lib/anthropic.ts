/**
 * Centralized AI service layer for weekly coding summaries.
 *
 * Design
 * ------
 * - Server-side only: the ANTHROPIC_API_KEY never touches the client bundle.
 * - Provider-agnostic interface: callers receive a plain string summary or
 *   null — swapping the underlying model requires changes only in this file.
 * - Fail-open: when the API is unavailable the function returns null and
 *   callers fall back to a rule-based message, so the UI degrades gracefully.
 * - Retry with exponential back-off: transient errors (network failure,
 *   server overload) are retried up to MAX_RETRIES times.
 * - Timeout: each attempt is aborted after TIMEOUT_MS to prevent serverless
 *   function hangs.
 *
 * Usage
 *   const summary = await generateWeeklySummary(metrics);
 *   if (!summary) { /* show rule-based fallback *\/ }
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 150; // sufficient for 2-3 sentences
const TEMPERATURE = 0.3; // low variance → more deterministic output
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2; // 3 attempts total

const SYSTEM_PROMPT =
  "You are DevTrack's weekly coding insight engine. " +
  "Given a JSON snapshot of a developer's activity for the current week, " +
  "write a brief 2–3 sentence summary. " +
  "Be positive but strictly factual — never fabricate achievements or numbers " +
  "that are not present in the supplied data. " +
  "Address the developer as 'you'. " +
  "No bullet points, no markdown formatting.";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyMetrics {
  commits: {
    current: number;
    previous: number;
    delta: number;
    trend: "up" | "down" | "same";
  };
  prs: {
    thisWeek: { opened: number; merged: number };
    lastWeek: { opened: number; merged: number };
  };
  streak: number;
  topRepo: string | null;
  activeDays: { thisWeek: number; lastWeek: number };
}

// ── Client factory ───────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 0, // we handle retries ourselves for timeout control
    });
  }
  return _client;
}

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildUserMessage(metrics: WeeklyMetrics): string {
  return JSON.stringify(
    {
      commits_this_week: metrics.commits.current,
      commits_last_week: metrics.commits.previous,
      commit_trend: metrics.commits.trend,
      prs_opened_this_week: metrics.prs.thisWeek.opened,
      prs_merged_this_week: metrics.prs.thisWeek.merged,
      prs_merged_last_week: metrics.prs.lastWeek.merged,
      active_days_this_week: metrics.activeDays.thisWeek,
      active_days_last_week: metrics.activeDays.lastWeek,
      current_streak_days: metrics.streak,
      top_repository: metrics.topRepo ?? "none",
    },
    null,
    2
  );
}

// ── Retry helper ─────────────────────────────────────────────────────────────

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // Duck-type the Anthropic APIError shape: any error with a numeric `status`
    // property is a structured API response.  Check retryable status codes
    // without depending on class identity (which is unreliable when the SDK is
    // mocked in tests with vi.resetModules()).
    //   529 = Anthropic overloaded
    //   503 = service unavailable
    const status = (err as unknown as { status?: unknown }).status;
    if (typeof status === "number") {
      return status === 529 || status === 503;
    }
    // Network-level abort (ECONNRESET, timeout signal, etc.)
    return err.name === "AbortError";
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates a 2–3 sentence weekly coding summary from the supplied metrics.
 *
 * Returns the summary string on success, or `null` when:
 *  - ANTHROPIC_API_KEY is not configured
 *  - All retry attempts are exhausted
 *  - The API returns an unusable response
 *
 * Callers should display a rule-based fallback message when null is returned.
 */
export async function generateWeeklySummary(
  metrics: WeeklyMetrics
): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.warn("[anthropic] ANTHROPIC_API_KEY is not set — skipping AI generation");
    return null;
  }

  const userMessage = buildUserMessage(metrics);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential back-off: 1 s, 2 s
      await sleep(1000 * attempt);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        },
        { signal: controller.signal }
      );

      const block = response.content[0];
      if (block?.type !== "text" || !block.text.trim()) {
        console.warn("[anthropic] Unexpected response shape:", response.content);
        return null;
      }

      return block.text.trim();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err)) {
        // Non-transient error — log and bail immediately
        console.error("[anthropic] Non-retryable error:", err);
        return null;
      }

      if (attempt < MAX_RETRIES) {
        console.warn(
          `[anthropic] Transient error on attempt ${attempt + 1}, retrying…`,
          err
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }

  console.error(
    `[anthropic] All ${MAX_RETRIES + 1} attempts failed:`,
    lastError
  );
  return null;
}
