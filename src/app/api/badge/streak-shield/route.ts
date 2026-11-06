import {
  currentStreakCoverage,
  fetchCommitStreakDates,
  type StreakCoverage,
} from "@/lib/streak-data";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubRequest } from "@/lib/github-request";
import { NextRequest, NextResponse } from "next/server";
import {
  lastSevenDays,
  renderStreakBadge,
} from "@/lib/gamification/stat-badge";
import { svgBadgeResponse } from "@/lib/gamification/badge-response";
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
// Streaks come from GitHub search, so the CDN keeps them for an hour; the
// short max-age stops GitHub's image proxy holding a stale day count.
const STREAK_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

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
): Promise<StreakData & { coverage: StreakCoverage; lastWeek: boolean[] }> {
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
  const freezeDates = new Set((freezes ?? []).map((row) => row.freeze_date));
  const streak = calculateStreakFromDates(dates, freezeDates, timeZone);
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
    lastWeek: lastSevenDays(today).map(
      (day) => dates.has(day) || freezeDates.has(day)
    ),
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
      return svgBadgeResponse(renderStreakBadge({ state: "syncing" }), req, {
        cacheControl: "public, max-age=300, s-maxage=300",
      });
    }

    const svg = renderStreakBadge({
      state: "ok",
      current: streak.current,
      longest: streak.longest,
      lowerBound: streak.coverage === "lower-bound",
      lastWeek: streak.lastWeek,
    });
    return svgBadgeResponse(svg, req, {
      cacheControl: STREAK_CACHE_CONTROL,
      extraHeaders: {
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

    return svgBadgeResponse(renderStreakBadge({ state: "error" }), req, {
      status: 500,
      cacheControl: "public, max-age=60",
    });
  }
}
