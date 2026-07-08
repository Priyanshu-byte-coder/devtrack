/**
 * Weekly coding digest cron endpoint.
 *
 * Triggered by Vercel Cron every Monday at 09:00 UTC (see vercel.json).
 * Self-hosted deployments can call this route from any external scheduler
 * by supplying:  Authorization: Bearer <CRON_SECRET>
 *
 * Execution model
 * ───────────────
 * 1. Authenticate via CRON_SECRET (fail-closed when env var is absent).
 * 2. Fetch opted-in users in paginated batches of PAGE_SIZE (50) to avoid
 *    loading the entire user table into memory and hitting Vercel timeout
 *    limits on large deployments.
 * 3. Skip users whose last digest was sent within the past 6 days
 *    (idempotency guard prevents duplicate sends on re-runs).
 * 4. Fetch weekly metrics via GITHUB_TOKEN when configured; fall back
 *    to sending the email without metrics when the token is absent.
 * 5. Render HTML + plain-text email and POST to Resend.
 * 6. Record the send timestamp (best-effort; failure does not cancel batch).
 * 7. Within each page, process users in bounded parallel sub-batches
 *    (BATCH_SIZE = 5) via Promise.allSettled so one failure never blocks
 *    the rest.
 * 8. Return { totalUsersProcessed, emailsSent, emailsFailed, skippedCount, errors }.
 *
 * Backward-compatible contract:
 *   • `message: "No users opted in"` when zero opted-in rows exist.
 *   • Auth errors return the same 401 / 500 shapes as before.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildDigestMetrics, buildUnsubscribeUrl } from "@/lib/weekly-digest";
import { buildDigestHtml, buildDigestText } from "@/lib/digest-email";
import { validateCronRequest } from "@/lib/cron-auth";
import type { DigestMetrics } from "@/lib/weekly-digest";

export const dynamic = "force-dynamic";

// Users who received a digest within the past 6 days are skipped so a
// duplicate cron trigger does not send two emails in the same week.
const DIGEST_COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000;

// Rows fetched per Supabase query — keeps each DB round-trip bounded and
// prevents loading the entire users table into serverless memory.
const PAGE_SIZE = 50;

// Maximum users processed in parallel within a fetched page.
const BATCH_SIZE = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id?: string;
  github_login: string;
  email: string;
  timezone?: string | null;
  last_digest_sent_at?: string | null;
}

interface SendError {
  user: string;
  error: string;
}

type SendResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUserLocalTimeTargetRange(timezone: string | null | undefined): boolean {
  if (!timezone) {
    // Fallback: If no timezone is set, treat as UTC.
    const nowUtc = new Date();
    const utcHour = nowUtc.getUTCHours();
    const utcDay = nowUtc.getUTCDay(); // 1 = Monday
    return utcDay === 1 && utcHour === 9;
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      weekday: "short",
      hour: "numeric",
    });
    const parts = formatter.formatToParts(new Date());
    const partsMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const localWeekday = partsMap.weekday; // "Mon", "Tue", etc.
    const localHour = parseInt(partsMap.hour, 10);
    return localWeekday === "Mon" && localHour === 9;
  } catch (err) {
    // Fallback on invalid timezone
    const nowUtc = new Date();
    const utcHour = nowUtc.getUTCHours();
    const utcDay = nowUtc.getUTCDay();
    return utcDay === 1 && utcHour === 9;
  }
}

function currentWeekLabelInTimezone(timezone: string | null | undefined): string {
  let localDate = new Date();
  if (timezone) {
    try {
      const options = { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" } as const;
      const formatter = new Intl.DateTimeFormat("en-US", options);
      localDate = new Date(formatter.format(new Date()));
    } catch (_) {}
  }

  const dayOfWeek = localDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(localDate);
  monday.setDate(localDate.getDate() + daysToMonday);

  return monday.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Send one digest email via Resend.
 * Returns { ok: true } on success, { ok: false, error } on failure.
 * When RESEND_API_KEY is absent the call is skipped and treated as sent,
 * so self-hosted deployments using an external mailer are not penalised.
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: true, skipped: true };
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "DevTrack <digest@devtrack.app>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      return { ok: false, error: `Resend HTTP ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Record the digest send timestamp for a user.
 * Best-effort — errors are logged but do not propagate to the caller.
 */
async function recordDigestSent(userId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("users")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .eq("id", userId);
  } catch (err) {
    console.error(`[weekly-digest] Failed to record send for ${userId}:`, err);
  }
}

/**
 * Process a single user: check timezone, check cooldown, fetch metrics, render and send email,
 * then record the send timestamp.
 */
async function processUser(
  user: UserRow,
  githubToken: string | undefined
): Promise<{
  status: "sent" | "failed" | "skipped_cooldown" | "skipped_unconfigured" | "skipped_timezone";
  error?: string;
}> {
  // ── Timezone check ────────────────────────────────────────────────────────
  if (!isUserLocalTimeTargetRange(user.timezone)) {
    return { status: "skipped_timezone" };
  }

  // ── Cooldown guard ────────────────────────────────────────────────────────
  if (user.last_digest_sent_at) {
    const lastSent = new Date(user.last_digest_sent_at).getTime();
    if (Date.now() - lastSent < DIGEST_COOLDOWN_MS) {
      return { status: "skipped_cooldown" };
    }
  }

  // ── Dynamic Week Label ───────────────────────────────────────────────────
  const weekLabel = currentWeekLabelInTimezone(user.timezone);

  // ── Metric aggregation ────────────────────────────────────────────────────
  let metrics: DigestMetrics | null = null;
  if (githubToken) {
    try {
      metrics = await buildDigestMetrics(user.github_login, githubToken);
    } catch (err) {
      // Log and continue — the email is still delivered without live metrics.
      console.warn(
        `[weekly-digest] Metrics fetch failed for ${user.github_login}:`,
        err
      );
    }
  }

  // ── Build unsubscribe URL ─────────────────────────────────────────────────
  const unsubscribeUrl = user.id
    ? buildUnsubscribeUrl(user.id)
    : `${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/settings`;

  // ── Render email ──────────────────────────────────────────────────────────
  const emailData = {
    githubLogin: user.github_login,
    metrics,
    unsubscribeUrl,
    weekLabel,
  };

  const html = buildDigestHtml(emailData);
  const text = buildDigestText(emailData);

  // ── Send ──────────────────────────────────────────────────────────────────
  const result = await sendEmail({
    to: user.email,
    subject: `Your weekly coding digest — ${weekLabel}`,
    html,
    text,
  });

  if (!result.ok) {
    return {
      status: "failed",
      error: result.error,
    };
  }

  if (result.skipped) {
    return {
      status: "skipped_unconfigured",
    };
  }

  if (user.id) {
    await recordDigestSent(user.id);
  }

  return {
    status: "sent",
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // 1. Authenticate via the centralized hardening utility
  const authValidationError = validateCronRequest(request);
  if (authValidationError) {
    // Returns the exact pre-baked 401 or 500 NextResponse generated by the helper
    return authValidationError;
  }

  try {
    const githubToken = process.env.GITHUB_TOKEN || undefined;

    let totalUsersProcessed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let skippedCount = 0;
    let skippedTimezoneCount = 0;
    const errors: SendError[] = [];

    // 2. Page through opted-in users so no single query loads the full table.
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: users, error } = await supabaseAdmin
        .from("users")
        .select("id, github_login, email, timezone, last_digest_sent_at")
        .eq("weekly_digest_opt_in", true)
        .not("email", "is", null)
        .order("id")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error("[weekly-digest] Error fetching users:", error);
        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: 500 }
        );
      }

      if (!users?.length) break;

      totalUsersProcessed += users.length;

      // 3. Within each page, send in parallel sub-batches to cap concurrency.
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = (users as UserRow[]).slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map((user) => processUser(user, githubToken))
        );

        for (let j = 0; j < results.length; j++) {
          const user = batch[j];
          const result = results[j];

          if (result.status === "rejected") {
            emailsFailed++;
            errors.push({
              user: user.github_login,
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            });
          } else {
            const { status, error: sendError } = result.value;
            if (status === "sent") {
              emailsSent++;
            } else if (status === "failed") {
              emailsFailed++;
              errors.push({
                user: user.github_login,
                error: sendError ?? "Unknown error",
              });
            } else if (status === "skipped_cooldown") {
              skippedCount++;
            } else if (status === "skipped_timezone") {
              skippedTimezoneCount++;
            }
          }
        }
      }

      // A partial page means we've reached the last page.
      hasMore = users.length === PAGE_SIZE;
      page++;
    }

    if (totalUsersProcessed === 0) {
      return NextResponse.json({ message: "No users opted in" });
    }

    console.log(
      `[weekly-digest] done — processed:${totalUsersProcessed} sent:${emailsSent} failed:${emailsFailed} skipped_cooldown:${skippedCount} skipped_timezone:${skippedTimezoneCount}`
    );

    return NextResponse.json({
      success: true,
      totalUsersProcessed,
      emailsSent,
      emailsFailed,
      skippedCount,
      skippedTimezoneCount,
      errors,
    });
  } catch (err) {
    console.error("[weekly-digest] Cron failed:", err);
    return NextResponse.json(
      { error: "Failed to process digests" },
      { status: 500 }
    );
  }
}
