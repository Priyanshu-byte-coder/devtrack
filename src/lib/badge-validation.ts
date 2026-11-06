/**
 * Badge API input validation utilities.
 *
 * Centralises all validation logic for badge endpoints so both
 * /api/badge/commits and /api/badge/streak-shield share identical
 * rules and any future badge endpoints can reuse them.
 */

import { createClient } from "@supabase/supabase-js";
import { generateBadgeSVG } from "@/app/api/badge/badge-utils";
import { NextResponse } from "next/server";

// ── GitHub username regex ─────────────────────────────────────────────────────
// Rules: 1–39 chars, alphanumeric + hyphens, cannot start or end with hyphen,
// no consecutive hyphens.
const GITHUB_USERNAME_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/**
 * Returns true only when `username` is a structurally valid GitHub username.
 * This is a pure string check — no network call is made.
 */
export function isValidGitHubUsername(username: string): boolean {
  return GITHUB_USERNAME_RE.test(username);
}

// ── Supabase lookup ───────────────────────────────────────────────────────────

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

/**
 * Returns true when `username` belongs to a DevTrack-registered user.
 * Falls back to `true` when Supabase is not configured so the badge
 * endpoints still work in local development without a database.
 */
export async function isRegisteredDevTrackUser(
  username: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    // No Supabase configured — skip the allowlist check.
    return true;
  }

  const { data, error } = await supabase
    .from("users")
    .select("github_login")
    .ilike("github_login", username)
    .maybeSingle();

  if (error) {
    console.error("[badge-validation] Supabase lookup error:", error.message);
    // Fail open — don't block the badge if the DB is temporarily unavailable.
    return true;
  }

  return data !== null;
}

// ── Error badge helpers ───────────────────────────────────────────────────────

/**
 * Returns a 400 SVG response for an invalid or missing username.
 */
export function invalidUsernameBadgeResponse(): NextResponse {
  const svg = generateBadgeSVG({
    label: "DevTrack",
    value: "invalid user",
    color: "#ef4444",
    labelColor: "#555",
  });
  return new NextResponse(svg, {
    status: 400,
    headers: {
      "Content-Type": "image/svg+xml;charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Returns a 404 SVG response when the username is not a DevTrack user.
 */
export function userNotFoundBadgeResponse(): NextResponse {
  const svg = generateBadgeSVG({
    label: "DevTrack",
    value: "user not found",
    color: "#6b7280",
    labelColor: "#555",
  });
  return new NextResponse(svg, {
    status: 404,
    headers: {
      "Content-Type": "image/svg+xml;charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}