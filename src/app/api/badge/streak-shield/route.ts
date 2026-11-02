import {
  currentStreakCoverage,
  fetchCommitStreakDates,
  type StreakCoverage,
} from "@/lib/streak-data";
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

async function fetchStreak(
  username: string,
  token?: string
): Promise<StreakData & { coverage: StreakCoverage }> {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id,timezone,github_id")
    .ilike("github_login", username)
    .single();
  if (error || !user) throw new Error("Badge user unavailable");
  const { data: freezes, error: freezeError } = await supabaseAdmin
    .from("streak_freezes")
    .select("freeze_date")
    .eq("user_id", user.id);
  if (freezeError) throw new Error("Badge freezes unavailable");
  const dates = await fetchCommitStreakDates(
    username,
    token,
    { bypass: false, userId: `public:${user.github_id}` },
    user.timezone ?? "UTC",
    "public"
  );
  const timeZone = user.timezone ?? "UTC";
  const streak = calculateStreakFromDates(
    dates,
    new Set((freezes ?? []).map((row) => row.freeze_date)),
    timeZone
  );
  // Very active users exceed GitHub search's 1,000-result cap, so their year
  // of commits comes back partial. The current streak can still be exact, or
  // at worst a lower bound; only refuse when search itself timed out.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return {
    ...streak,
    coverage: currentStreakCoverage(dates, streak.current, today),
  };
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

    if (streak.coverage === "unknown") {
      // GitHub's search timed out partway; show a neutral badge and let
      // caches retry soon rather than publishing a wrong number.
      return new NextResponse(
        generateBadgeSVG({
          label: "DevTrack",
          value: "streak syncing",
          color: "#9f9f9f",
          labelColor: "#555",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml;charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=300",
            "X-Content-Type-Options": "nosniff",
          },
        }
      );
    }

    const days = `${streak.current}${streak.coverage === "lower-bound" ? "+" : ""}`;
    const svg = generateBadgeSVG({
      label: "DevTrack",
      value: `🔥 ${days} day streak`,
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
