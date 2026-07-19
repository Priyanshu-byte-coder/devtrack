/**
 * Unsubscribe endpoint for the weekly email digest.
 *
 * Every digest email contains a unique unsubscribe link:
 *   GET /api/unsubscribe?uid=<userId>&token=<hmac>
 *
 * The HMAC token is deterministic (derived from the user ID and a server
 * secret) so no database row is needed to verify it.  This means:
 *   • Tokens work even after a database restore.
 *   • Old tokens in archived emails remain valid (idempotent unsubscribe).
 *   • A valid token for user A cannot unsubscribe user B.
 *
 * Security properties:
 *   • Token is verified with constant-time comparison (timingSafeEqual).
 *   • Missing or malformed tokens return 403 — not a redirect to a login page,
 *     which would expose the uid in a browser Referer header.
 *   • The uid parameter is validated to be a UUID before the DB update to
 *     prevent injection via malformed user IDs.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyUnsubscribeToken } from "@/lib/weekly-digest";

export const dynamic = "force-dynamic";

// Loose UUID format check — Supabase uses UUID v4 primary keys.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Accept plain Request so the handler works with both Next.js (NextRequest)
// and plain fetch-compatible Request objects (e.g. in unit tests).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  // ── Input validation ──────────────────────────────────────────────────────
  if (!uid || !token) {
    return NextResponse.json(
      { error: "Missing uid or token" },
      { status: 400 }
    );
  }

  // Validate uid format before using it in a database query.
  if (!UUID_RE.test(uid)) {
    return NextResponse.json({ error: "Invalid uid" }, { status: 400 });
  }

  // ── Token verification ────────────────────────────────────────────────────
  if (!verifyUnsubscribeToken(uid, token)) {
    return NextResponse.json(
      { error: "Invalid or expired unsubscribe token" },
      { status: 403 }
    );
  }

  // ── Opt the user out ──────────────────────────────────────────────────────
  const { error } = await supabaseAdmin
    .from("users")
    .update({ weekly_digest_opt_in: false })
    .eq("id", uid);

  if (error) {
    console.error("[unsubscribe] DB update failed:", error);
    return NextResponse.json(
      { error: "Failed to process unsubscribe request" },
      { status: 500 }
    );
  }

  // ── Confirmation response ─────────────────────────────────────────────────
  // Return a simple HTML page so clicking the link from an email client
  // shows a human-readable confirmation rather than raw JSON.
  const appUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const settingsUrl = `${appUrl}/settings`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed — DevTrack</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 40px 20px;
           background: #f1f5f9; color: #0f172a; display: flex;
           justify-content: center; }
    .card { background: #fff; border-radius: 12px; padding: 40px;
            max-width: 480px; width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,.1); text-align: center; }
    h1 { margin: 0 0 12px 0; font-size: 22px; }
    p  { margin: 0 0 16px 0; color: #475569; line-height: 1.6; }
    a  { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <p style="font-size: 48px; margin: 0 0 16px;">&#x2705;</p>
    <h1>You have been unsubscribed</h1>
    <p>
      You will no longer receive weekly coding digest emails from DevTrack.
    </p>
    <p>
      You can re-enable the digest at any time in your
      <a href="${settingsUrl}">account settings</a>.
    </p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
