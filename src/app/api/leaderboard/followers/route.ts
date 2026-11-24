import { NextRequest, NextResponse } from "next/server";
import { fetchFollowersLeaderboard, FollowerSortField } from "@/lib/followers-leaderboard";
import { createMemoryFixedWindowRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getUpstashConfig, upstashRateLimitFixedWindow } from "@/lib/upstash-rest";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const memoryLimiter = createMemoryFixedWindowRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  pruneIntervalMs: 5 * 60 * 1000,
  maxEntries: 10_000,
});

export async function GET(req: NextRequest): Promise<Response> {
  const ip = getClientIp(req);
  const rateLimit = getUpstashConfig()
    ? await upstashRateLimitFixedWindow({
        key: `followers-leaderboard-rate-limit:${ip}`,
        limit: RATE_LIMIT_REQUESTS,
        windowSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      })
    : (() => {
        const local = memoryLimiter.check(`followers-leaderboard-rate-limit:${ip}`, RATE_LIMIT_REQUESTS);
        return local.allowed
          ? { allowed: true }
          : {
              allowed: false,
              retryAfter: Math.max(local.reset - Math.floor(Date.now() / 1000), 1),
            };
      })();

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  const { searchParams } = new URL(req.url);
  let username = searchParams.get("username");
  const sortByParam = searchParams.get("sortBy") as FollowerSortField;
  const sortBy: FollowerSortField = ["streak", "commits", "prs"].includes(sortByParam)
    ? sortByParam
    : "streak";

  if (!username) {
    const session = await getServerSession(authOptions);
    username = (session?.user as { login?: string })?.login || null;
  }

  if (!username) {
    return NextResponse.json(
      { error: "Missing required username parameter or unauthenticated session" },
      { status: 400 }
    );
  }

  if (!GITHUB_USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const result = await fetchFollowersLeaderboard(username, sortBy);
    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch follower leaderboard" },
      { status: 500 }
    );
  }
}
