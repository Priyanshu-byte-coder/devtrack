import { NextRequest, NextResponse } from "next/server";
import { generateBadgeSVG } from "../badge-utils";
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
  return fetch(url, { headers, cache: "no-store" });
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

    const svg = generateBadgeSVG({
      label: "Commits",
      value: `${commits} this month`,
      color: "#6366f1",
      labelColor: "#333333",
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
    logError(error, {
      endpoint: "/api/badge/commits",
      operation: "generate_badge",
      additionalContext: { username },
    });

    const svg = generateBadgeSVG({
      label: "Commits",
      value: "Error",
      color: "#ef4444",
      labelColor: "#333333",
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