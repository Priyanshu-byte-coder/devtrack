/**
 * Shared authentication guard for cron and scheduled-sync endpoints.
 *
 * Design rationale
 * ----------------
 * Cron endpoints are invoked by an external scheduler (e.g. Vercel Cron) that
 * supplies a shared secret in the Authorization header.  They must never be
 * callable without a valid credential, regardless of deployment environment.
 *
 * A previous implementation pattern used:
 *
 *   if (authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") { … }
 *
 * which silently disabled authentication in the development environment.  Any
 * process running locally — or any attacker who can set NODE_ENV — could
 * trigger bulk operations (sponsor sync, wakatime sync, discord notifications)
 * without presenting credentials.
 *
 * This utility enforces the same strict check in every environment.
 *
 * Local development
 * -----------------
 * Set CRON_SECRET to any non-empty string in .env.local and pass the matching
 * Authorization header when calling a cron endpoint manually:
 *
 *   curl -H "Authorization: Bearer <your-CRON_SECRET>" http://localhost:3000/api/…
 *
 * This is consistent with how Vercel supplies the header in production and keeps
 * local behaviour identical to the deployed environment.
 */

import { NextResponse } from "next/server";

/**
 * Validates the Authorization header on a cron / sync request.
 *
 * Returns `null` when the request is authorized and execution should continue.
 * Returns a `NextResponse` (401 or 500) that the caller must return immediately
 * when the request is unauthorized or the environment is misconfigured.
 *
 * Usage:
 *
 *   const authError = validateCronRequest(req);
 *   if (authError) return authError;
 *   // … proceed with the job
 */
export function validateCronRequest(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: if CRON_SECRET is not configured the endpoint must not run.
  // Accepting requests when the secret is absent would mean any caller could
  // trigger the job by supplying the literal string "Bearer undefined".
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
