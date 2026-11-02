import { fetchCommitStreakDates } from "@/lib/streak-data";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubRequest } from "@/lib/github-request";
import { NextRequest, NextResponse } from "next/server";
import { generateBadgeSVG } from "../badge-utils";
import { checkBadgeRateLimit, getBadgeClientIp } from "@/lib/badge-rate-limit";
import { calculateStreakFromDates } from "@/lib/streak";
import { logError } from "@/lib/error-handler";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import {
  isValidGitHubUsername,
  isRegisteredDevTrackUser,
  invalidUsernameBadgeResponse,
  userNotFoundBadgeResponse,
} from "@/lib/badge-validation";

export const dynamic = "force-dynamic";

const GITHUB_API = "https://api.github.com";

interface StreakData {
  current: number;
  longest: number;
  lastCommitDate: string | null;
  totalActiveDays: number;
  stale?: boolean;
}

async function fetchGitHubWithToken(
  url: string,
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return githubRequest(url, { headers, cache: "no-store" });
}

async function fetchStreak(username: string, token?: string): Promise<StreakData> {
  const {data:user,error}=await supabaseAdmin.from('users').select('id,timezone,github_id').ilike('github_login',username).single();
  if(error || !user) throw new Error('Badge user unavailable');
  const {data:freezes,error:freezeError}=await supabaseAdmin.from('streak_freezes').select('freeze_date').eq('user_id',user.id);
  if(freezeError) throw new Error('Badge freezes unavailable');
  const dates=await fetchCommitStreakDates(username,token,{bypass:false,userId:`public:${user.github_id}`},user.timezone ?? 'UTC','public');
  if(!dates.complete) throw new Error('Incomplete streak history');
  return calculateStreakFromDates(dates,new Set((freezes ?? []).map(row=>row.freeze_date)),user.timezone ?? 'UTC');
}

export async function GET(req: NextRequest) {
  // ── 1. Rate limiting ────────────────────────────────────────────────────────
  const ip = getBadgeClientIp(req);
  const rateLimit = checkBadgeRateLimit(ip);

  if (!rateLimit.allowed) {
    return new NextResponse("Rate limit exceeded", {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.max(rateLimit.reset - Math.floor(Date.now() / 1000), 1)
        ),
        "X-RateLimit-Limit": "20",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rateLimit.reset),
      },
    });
  }

  // ── 2. Input validation ─────────────────────────────────────────────────────
  const rawUser = req.nextUrl.searchParams.get("user");
  const username = normalizeGitHubUsername(rawUser);

  if (!username || !isValidGitHubUsername(username)) {
    return invalidUsernameBadgeResponse();
  }

  // ── 3. DevTrack user allowlist check ────────────────────────────────────────
  const isRegistered = await isRegisteredDevTrackUser(username);
  if (!isRegistered) {
    return userNotFoundBadgeResponse();
  }

  // ── 4. Fetch and render ─────────────────────────────────────────────────────
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const streak = await fetchStreak(username, githubToken);

    const svg = generateBadgeSVG({
      label: "DevTrack",
      value: `🔥 ${streak.current} day streak`,
      color: streak.current > 0 ? "#4c1" : "#e05d44",
      labelColor: "#555",
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml;charset=utf-8",
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.reset),
      },
    });
  } catch (error) {
    const githubLimit = githubRateLimitResponse(error);
    if (githubLimit) return githubLimit;

    logError(error, {
      endpoint: "/api/badge/streak-shield",
      operation: "generate_badge",
      additionalContext: { username },
    });

    const svg = generateBadgeSVG({
      label: "DevTrack",
      value: "Error",
      color: "#ef4444",
      labelColor: "#555",
    });

    return new NextResponse(svg, {
      status: 500,
      headers: {
        "Content-Type": "image/svg+xml;charset=utf-8",
        "Cache-Control": "max-age=60, public",
      },
    });
  }
}