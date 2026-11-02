import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubRequest } from "@/lib/github-request";
import { NextRequest, NextResponse } from "next/server";
import { renderCommitsBadge } from "@/lib/gamification/stat-badge";
import { svgBadgeResponse } from "@/lib/gamification/badge-response";
import { checkBadgeRateLimit, getBadgeClientIp } from "@/lib/badge-rate-limit";
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
// Counts come from GitHub search, so the CDN keeps them for an hour; the
// short max-age stops GitHub's image proxy holding last month's number.
const COMMITS_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

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

async function fetchCommitsThisMonth(
  username: string,
  token?: string
): Promise<number> {
  const since = new Date();
  since.setDate(1);
  const sinceStr = since.toISOString().slice(0, 10);

  const url = new URL(`${GITHUB_API}/search/commits`);
  url.searchParams.set("q", `author:${username} author-date:>=${sinceStr}`);
  url.searchParams.set("per_page", "1");

  const searchRes = await fetchGitHubWithToken(url.toString(), token);

  if (!searchRes.ok) {
    const errorBody = await searchRes.text();
    console.error(`GitHub API error fetching commits for ${username}:`, {
      status: searchRes.status,
      url: url.toString(),
      body: errorBody,
    });
    return 0;
  }

  const data = (await searchRes.json()) as { total_count: number };
  return data.total_count || 0;
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
    const commits = await fetchCommitsThisMonth(username, githubToken);

    const now = new Date();
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const svg = renderCommitsBadge({
      state: "ok",
      commits,
      month: now.getUTCMonth(),
      year: now.getUTCFullYear(),
      monthProgress: now.getUTCDate() / daysInMonth,
    });
    return svgBadgeResponse(svg, req, {
      cacheControl: COMMITS_CACHE_CONTROL,
      extraHeaders: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.reset),
      },
    });
  } catch (error) {
    const githubLimit = githubRateLimitResponse(error);
    if (githubLimit) return githubLimit;

    logError(error, {
      endpoint: "/api/badge/commits",
      operation: "generate_badge",
      additionalContext: { username },
    });

    return svgBadgeResponse(renderCommitsBadge({ state: "error" }), req, {
      status: 500,
      cacheControl: "public, max-age=60",
    });
  }
}
