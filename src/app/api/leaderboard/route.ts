import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { dateDiffDays, toDateStr } from "@/lib/date-utils";
import {
  cacheGet,
  cacheSet,
  isMetricsCacheBypassed,
} from "@/lib/metrics-cache";
import {
  pruneExpiredLeaderboardCache,
  pruneExpiredRateLimits,
  type LeaderboardCacheEntry,
  type RateLimitEntry,
} from "@/lib/leaderboard-cache";
import {
  getUpstashConfig,
  upstashRateLimitFixedWindow,
  upstashTryAcquireLock,
} from "@/lib/upstash-rest";
import {
  applyLeaderboardQuery,
  buildLeaderboardCacheKey,
  getRangeStartDate,
  parseLeaderboardQueryFromSearchParams,
  type LeaderboardEntry,
  type LeaderboardMetric,
  type LeaderboardPagination,
  type LeaderboardQuery,
  type Scope,
} from "@/lib/leaderboard-query";

export const dynamic = "force-dynamic";

const GITHUB_API = "https://api.github.com";
const CACHE_REFRESH_SECONDS = 60 * 60; // 1 hour
const CACHE_STALE_SECONDS = 6 * 60 * 60; // 6 hours
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * Validates and sanitizes the LEADERBOARD_USER_CONCURRENCY environment variable
 * Ensures the value is within safe operational bounds [1, 100]
 */
function validateUserConcurrency(value: string | undefined): number {
  const DEFAULT_CONCURRENCY = 5;
  const MIN_CONCURRENCY = 1;
  const MAX_CONCURRENCY = 100;

  // No value provided: use default
  if (!value) {
    return DEFAULT_CONCURRENCY;
  }

  // Parse the value
  const parsed = Number(value);

  // Validate: must be a finite integer
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    console.warn(
      `[Leaderboard] Invalid LEADERBOARD_USER_CONCURRENCY value: "${value}". Using default: ${DEFAULT_CONCURRENCY}`
    );
    return DEFAULT_CONCURRENCY;
  }

  // Validate: must be within bounds
  if (parsed < MIN_CONCURRENCY || parsed > MAX_CONCURRENCY) {
    const clamped = Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, parsed));
    console.warn(
      `[Leaderboard] LEADERBOARD_USER_CONCURRENCY ${parsed} is outside safe range [${MIN_CONCURRENCY}, ${MAX_CONCURRENCY}]. Clamping to ${clamped}`
    );
    return clamped;
  }

  // Log when using non-default value
  if (parsed !== DEFAULT_CONCURRENCY) {
    console.info(`[Leaderboard] Using custom concurrency: ${parsed}`);
  }

  return parsed;
}

const USER_CONCURRENCY = validateUserConcurrency(process.env.LEADERBOARD_USER_CONCURRENCY);

const LEADERBOARD_BUILD_LOCK_KEY = "leaderboard:build-lock:v1";

interface PublicUser {
  id: string;
  github_login: string;
}

interface LeaderboardCachePayload {
  generatedAt: string;
  refreshSeconds: number;
  query: {
    range: LeaderboardQuery["range"];
    scope: Scope;
  };
  rows: LeaderboardEntry[];
}

interface LeaderboardPayload extends LeaderboardCachePayload {
  items: LeaderboardEntry[];
  pagination: LeaderboardPagination;
  leaders: Record<LeaderboardMetric, LeaderboardEntry[]>;
}

function getRateLimitKey(req: NextRequest): string {
  return (
    req.ip ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

const memoryLeaderboardCache = new Map<
  string,
  LeaderboardCacheEntry<LeaderboardCachePayload>
>();
const memoryRateLimits = new Map<string, RateLimitEntry>();

function checkMemoryRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
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

  return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
}

async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (getUpstashConfig()) {
    return upstashRateLimitFixedWindow({
      key: `leaderboard-rate-limit:${ip}`,
      limit: RATE_LIMIT_REQUESTS,
      windowSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    });
  }

  return checkMemoryRateLimit(ip);
}

function isFresh(payload: LeaderboardCachePayload): boolean {
  const generatedAt = Date.parse(payload.generatedAt);
  if (!Number.isFinite(generatedAt)) {
    return false;
  }
  return Date.now() - generatedAt < CACHE_REFRESH_SECONDS * 1000;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const safeConcurrency =
    Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 1;
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(safeConcurrency, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

async function fetchGitHubJson<T>(path: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${GITHUB_API}${path}`, {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    console.error("GitHub leaderboard request failed:", path, res.status);
    return null;
  }

  return (await res.json()) as T;
}

function calculateCurrentStreak(commitDates: string[]): number {
  const days = Array.from(new Set(commitDates.map((date) => date.slice(0, 10)))).sort();
  if (days.length === 0) {
    return 0;
  }

  let runLength = 1;
  const runs: { end: string; length: number }[] = [];
  for (let i = 1; i < days.length; i += 1) {
    if (dateDiffDays(days[i - 1], days[i]) === 1) {
      runLength += 1;
    } else {
      runs.push({ end: days[i - 1], length: runLength });
      runLength = 1;
    }
  }
  runs.push({ end: days[days.length - 1], length: runLength });

  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  const latest = runs[runs.length - 1];
  return latest.end === today || latest.end === yesterday ? latest.length : 0;
}

async function fetchCommitStats(username: string, since: string) {
  const query = new URLSearchParams({
    q: `author:${username} author-date:>=${since}`,
    per_page: "100",
    sort: "author-date",
    order: "desc",
  });
  return fetchGitHubJson<{
    total_count: number;
    items: Array<{ commit: { author: { date: string } } }>;
  }>(`/search/commits?${query.toString()}`);
}

async function fetchPrCount(username: string, since: string): Promise<number> {
  const query = new URLSearchParams({
    q: `author:${username} type:pr created:>=${since}`,
    per_page: "1",
  });
  const data = await fetchGitHubJson<{ total_count: number }>(
    `/search/issues?${query.toString()}`
  );
  return data?.total_count ?? 0;
}

function buildLeadersByMetric(rows: LeaderboardEntry[]): Record<LeaderboardMetric, LeaderboardEntry[]> {
  const rankBy = (metric: LeaderboardMetric) =>
    [...rows]
      .sort((a, b) => b[metric] - a[metric] || b.score - a.score)
      .slice(0, 50)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    streak: rankBy("streak"),
    commits: rankBy("commits"),
    prs: rankBy("prs"),
  };
}

function formatLeaderboardResponse(
  cached: LeaderboardCachePayload,
  query: LeaderboardQuery
): LeaderboardPayload {
  const { items, pagination } = applyLeaderboardQuery(cached.rows, query);

  return {
    generatedAt: cached.generatedAt,
    refreshSeconds: cached.refreshSeconds,
    query: cached.query,
    rows: cached.rows,
    items,
    pagination,
    leaders: buildLeadersByMetric(cached.rows),
  };
}

async function buildLeaderboard(query: LeaderboardQuery): Promise<LeaderboardCachePayload> {
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, github_login")
    .eq("is_public", true)
    .eq("leaderboard_opt_in", true)
    .limit(50);

  if (error) {
    console.error("Failed to fetch leaderboard users:", error);
    throw new Error("Failed to load leaderboard users");
  }

  const now = new Date();
  const rangeStart = getRangeStartDate(query.range, now);

  // Scope is currently reserved for repository/organization-level ranking support.
  const appliedScope: Scope = query.scope;

  const safeUsers = (users ?? []) as PublicUser[];

  const rows = await mapWithConcurrency(
    safeUsers,
    USER_CONCURRENCY,
    async (user) => {
      const [monthlyCommits, streakCommits, prs] = await Promise.all([
        fetchCommitStats(user.github_login, rangeStart),
        fetchCommitStats(user.github_login, rangeStart),
        fetchPrCount(user.github_login, rangeStart),
      ]);

      const streak = calculateCurrentStreak(
        streakCommits?.items.map((item) => item.commit.author.date) ?? []
      );
      const commits = monthlyCommits?.total_count ?? 0;
      const score = streak * 5 + commits + prs * 3;

      return {
        rank: 0,
        username: user.github_login,
        avatarUrl: `https://github.com/${user.github_login}.png?size=96`,
        profileUrl: `/u/${user.github_login}`,
        streak,
        commits,
        prs,
        score,
      };
    }
  );

  const sortedByScore = [...rows].sort(
    (a, b) => b.score - a.score || b.commits - a.commits || b.streak - a.streak
  );

  return {
    generatedAt: now.toISOString(),
    refreshSeconds: CACHE_REFRESH_SECONDS,
    query: {
      range: query.range,
      scope: appliedScope,
    },
    rows: sortedByScore.map((entry) => ({ ...entry, rank: 0 })),
  };
}

export async function GET(req: NextRequest) {
  const query = parseLeaderboardQueryFromSearchParams(req.nextUrl.searchParams);
  const cacheKey = buildLeaderboardCacheKey(query);
  const lockKey = `${LEADERBOARD_BUILD_LOCK_KEY}:${query.range}:${query.scope}`;

  const ip = getRateLimitKey(req);
  const rateLimit = await checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const bypass = isMetricsCacheBypassed(req);
  if (!bypass) {
    const memoryEntry = pruneExpiredLeaderboardCache(memoryLeaderboardCache.get(cacheKey) ?? null);
    if (memoryEntry) {
      memoryLeaderboardCache.set(cacheKey, memoryEntry);
    } else {
      memoryLeaderboardCache.delete(cacheKey);
    }

    if (memoryEntry && isFresh(memoryEntry.payload)) {
      return NextResponse.json(formatLeaderboardResponse(memoryEntry.payload, query), {
        headers: { "x-devtrack-leaderboard-cache": "memory" },
      });
    }

    const cached = await cacheGet<LeaderboardCachePayload>(cacheKey);
    if (cached && isFresh(cached)) {
      memoryLeaderboardCache.set(cacheKey, {
        payload: cached,
        expiresAt: Date.now() + CACHE_REFRESH_SECONDS * 1000,
      });
      return NextResponse.json(formatLeaderboardResponse(cached, query));
    }

    // Avoid thundering herd on cache misses across serverless instances.
    if (getUpstashConfig()) {
      const locked = await upstashTryAcquireLock({
        key: lockKey,
        ttlSeconds: 5 * 60,
      });

      if (!locked) {
        if (cached) {
          return NextResponse.json(formatLeaderboardResponse(cached, query), {
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
    const payload = await buildLeaderboard(query);
    await cacheSet(cacheKey, payload, CACHE_STALE_SECONDS);
    memoryLeaderboardCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CACHE_REFRESH_SECONDS * 1000,
    });
    return NextResponse.json(formatLeaderboardResponse(payload, query));
  } catch {
    const cached = await cacheGet<LeaderboardCachePayload>(cacheKey);
    if (cached) {
      return NextResponse.json(formatLeaderboardResponse(cached, query), {
        headers: { "x-devtrack-leaderboard-cache": "error-stale" },
      });
    }
    return NextResponse.json(
      { error: "Failed to build leaderboard" },
      { status: 500 }
    );
  }
}
