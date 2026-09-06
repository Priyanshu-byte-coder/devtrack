import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, isMetricsCacheBypassed } from "@/lib/metrics-cache";
import {
  CACHE_STALE_SECONDS,
  getLeaderboardCacheKey as getBaseLeaderboardCacheKey,
  getLeaderboardData,
  isFresh,
  LEADERBOARD_BUILD_LOCK_KEY,
  normalizeLeaderboardTimeframe,
  type LeaderboardPayload,
  filterLeaderboardByLanguage,
  type LeaderboardTimeframe,
} from "@/lib/leaderboard";
import {
  pruneExpiredRateLimits,
  type RateLimitEntry,
} from "@/lib/leaderboard-cache";
import {
  getUpstashConfig,
  upstashRateLimitFixedWindow,
  upstashTryAcquireLock,
} from "@/lib/upstash-rest";

export const dynamic = "force-dynamic";

const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const memoryRateLimits = new Map<string, RateLimitEntry>();

type RateLimitResult = { allowed: boolean; retryAfter?: number };

function getRateLimitKey(req: NextRequest): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
}

function checkMemoryRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  pruneExpiredRateLimits(memoryRateLimits, now);
  const record = memoryRateLimits.get(ip);

  if (!record || now > record.resetAt) {
    memoryRateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count < RATE_LIMIT_REQUESTS) {
    record.count += 1;
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfter: Math.ceil((record.resetAt - now) / 1000),
  };
}

async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (getUpstashConfig()) {
    return upstashRateLimitFixedWindow({
      key: `leaderboard-rate-limit:${ip}`,
      limit: RATE_LIMIT_REQUESTS,
      windowSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  return checkMemoryRateLimit(ip);
}

function normalizeLanguage(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeTimeframe(
  timeframe: string | null,
  period: string | null
): LeaderboardTimeframe | null {
  const normalizedTimeframe = normalizeLeaderboardTimeframe(timeframe);
  if (timeframe !== null && normalizedTimeframe === null) {
    return null;
  }

  if (normalizedTimeframe) {
    return normalizedTimeframe;
  }

  const normalizedPeriod = normalizeLeaderboardTimeframe(period);
  if (period !== null && normalizedPeriod === null) {
    return null;
  }

  return normalizedPeriod ?? "weekly";
}

function getLanguageCacheKey(filters: {
  language: string;
  timeframe: LeaderboardTimeframe;
}): string {
  return `${getBaseLeaderboardCacheKey(filters.timeframe)}:${filters.language}`;
}

function getLeaderboardBuildLockCacheKey(cacheKey: string): string {
  return `${LEADERBOARD_BUILD_LOCK_KEY}:${cacheKey}`;
}

export async function GET(req: NextRequest) {
  const ip = getRateLimitKey(req);
  const rateLimit = await checkRateLimit(ip);
  const language = normalizeLanguage(req.nextUrl.searchParams.get("lang"));
  const timeframe = normalizeTimeframe(
    req.nextUrl.searchParams.get("timeframe"),
    req.nextUrl.searchParams.get("period")
  );

  if (!timeframe) {
    return NextResponse.json(
      { error: "Invalid timeframe. Supported values are weekly, monthly, and all_time." },
      { status: 400 }
    );
  }

  const cacheKey = language
    ? getLanguageCacheKey({ language, timeframe })
    : getBaseLeaderboardCacheKey(timeframe);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  const bypass = isMetricsCacheBypassed(req);

  if (!bypass) {
    const cached = await cacheGet<LeaderboardPayload>(cacheKey);
    if (cached && isFresh(cached)) {
      return NextResponse.json(cached, {
        headers: { "x-devtrack-leaderboard-cache": "memory" },
      });
    }

    if (getUpstashConfig()) {
      const locked = await upstashTryAcquireLock({
        key: getLeaderboardBuildLockCacheKey(cacheKey),
        ttlSeconds: 5 * 60,
      });

      if (!locked) {
        if (cached) {
          return NextResponse.json(cached, {
            headers: { "x-devtrack-leaderboard-cache": "stale" },
          });
        }

        return NextResponse.json(
          { error: "Leaderboard is rebuilding. Please retry shortly." },
          { status: 503, headers: { "Retry-After": "5" } }
        );
      }
    }
  }

  try {
    const baseLeaderboard = await getLeaderboardData(bypass, { timeframe });

    if (!baseLeaderboard) {
      const stale = await cacheGet<LeaderboardPayload>(cacheKey);
      if (stale) {
        return NextResponse.json(stale, {
          headers: { "x-devtrack-leaderboard-cache": "error-stale" },
        });
      }

      return NextResponse.json(
        { error: "Failed to build leaderboard" },
        { status: 500 }
      );
    }

    const payload = language
      ? await filterLeaderboardByLanguage(baseLeaderboard, language)
      : baseLeaderboard;

    if (!bypass) {
      await cacheSet(cacheKey, payload, CACHE_STALE_SECONDS);
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Leaderboard API Error:", error);
    console.error("Stack:", error instanceof Error ? error.stack : error);

    const cached = await cacheGet<LeaderboardPayload>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "x-devtrack-leaderboard-cache": "error-stale" },
      });
    }

    return NextResponse.json(
      { error: "Failed to build leaderboard" },
      { status: 500 }
    );
  }
}