import { supabaseAdmin } from "@/lib/supabase";
import { dateDiffDays, toDateStr } from "@/lib/date-utils";
import { cacheGet, cacheSet, cacheDelete, invalidateLeaderboardCache } from "@/lib/metrics-cache";
import {
  pruneExpiredLeaderboardCache,
  type LeaderboardCacheEntry,
} from "@/lib/leaderboard-cache";
import { unstable_cache, revalidateTag } from "next/cache";

export const CACHE_REFRESH_SECONDS = 3600; // 1 hour
export const CACHE_STALE_SECONDS = 6 * 60 * 60; // 6 hours
export const LEADERBOARD_CACHE_KEY = "leaderboard:v1";
export const LEADERBOARD_BUILD_LOCK_KEY = "leaderboard:build-lock:v1";

const GITHUB_API = "https://api.github.com";

export type LeaderboardMetric = "streak" | "commits" | "prs";
export type LeaderboardPeriod = "week" | "month" | "all";

export interface LeaderboardFilters {
  period?: LeaderboardPeriod;
}

export interface PublicUser {
  id: string;
  github_login: string;
  is_sponsor: boolean;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  avatarUrl: string;
  profileUrl: string;
  streak: number;
  commits: number;
  prs: number;
  score: number;
  isSponsor: boolean;
}

export interface LeaderboardPayload {
  generatedAt: string;
  refreshSeconds: number;
  leaders: Record<LeaderboardMetric, LeaderboardEntry[]>;
}

function validateUserConcurrency(value: string | undefined): number {
  const DEFAULT = 5;
  const MIN = 1;
  const MAX = 100;

  if (!value) return DEFAULT;

  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    console.warn(
      `[Leaderboard] Invalid LEADERBOARD_USER_CONCURRENCY: "${value}". Using ${DEFAULT}`
    );
    return DEFAULT;
  }

  if (n < MIN || n > MAX) {
    const clamped = Math.max(MIN, Math.min(MAX, n));
    console.warn(
      `[Leaderboard] LEADERBOARD_USER_CONCURRENCY ${n} outside [${MIN}, ${MAX}], clamping to ${clamped}`
    );
    return clamped;
  }

  if (n !== DEFAULT) {
    console.info(`[Leaderboard] Using custom concurrency: ${n}`);
  }
  return n;
}

const USER_CONCURRENCY = validateUserConcurrency(
  process.env.LEADERBOARD_USER_CONCURRENCY
);

const DEFAULT_PERIOD: LeaderboardPeriod = "month";

// Module-level in-memory cache shared between the server component and API route
// within the same Node.js process (standalone mode).
let _memoryCache = new Map<string, LeaderboardCacheEntry<LeaderboardPayload>>();

/**
 * Checks if a cached leaderboard payload is still fresh based on its generation time.
 * @param payload - The leaderboard payload to check.
 * @returns True if the payload is within the cache refresh window.
 */
export function isFresh(payload: LeaderboardPayload): boolean {
  const ts = Date.parse(payload.generatedAt);
  return Number.isFinite(ts) && Date.now() - ts < CACHE_REFRESH_SECONDS * 1000;
}

/**
 * Generates the cache key for the leaderboard based on the given period.
 * @param period - The time period (e.g., 'week', 'month', 'all').
 * @returns The cache key string.
 */
export function getLeaderboardCacheKey(period: LeaderboardPeriod = DEFAULT_PERIOD): string {
  return `${LEADERBOARD_CACHE_KEY}:${period}`;
}

/**
 * Retrieves the in-memory cached leaderboard payload, if it is fresh.
 * @param period - The time period (e.g., 'week', 'month', 'all').
 * @returns The cached payload, or null if missing or stale.
 */
export function getMemoryCachedLeaderboard(
  period: LeaderboardPeriod = DEFAULT_PERIOD
): LeaderboardPayload | null {
  const cacheKey = getLeaderboardCacheKey(period);
  const cached = pruneExpiredLeaderboardCache(_memoryCache.get(cacheKey));

  if (cached && isFresh(cached.payload)) {
    return cached.payload;
  }

  if (!cached) {
    _memoryCache.delete(cacheKey);
  }

  return null;
}

/**
 * Stores a leaderboard payload in the in-memory cache.
 * @param payload - The leaderboard payload to store.
 * @param period - The time period.
 */
export function setMemoryCachedLeaderboard(
  payload: LeaderboardPayload,
  period: LeaderboardPeriod = DEFAULT_PERIOD
): void {
  const cacheKey = getLeaderboardCacheKey(period);
  _memoryCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + CACHE_REFRESH_SECONDS * 1000,
  });
}

/**
 * Evicts every layer of the leaderboard cache so the next request
 * fetches fresh eligibility data from the database.
 *
 * Must be called whenever a user changes settings that affect leaderboard
 * eligibility (is_public or leaderboard_opt_in) so that the updated
 * preference is reflected immediately rather than waiting up to one hour
 * for the cache to expire naturally.
 */
export async function clearLeaderboardCache(): Promise<void> {
  // 1. Drop the module-level in-process cache.
  _memoryCache.clear();

  // 2. Drop all leaderboard shared keys in metrics memory map and Redis/Upstash.
  await invalidateLeaderboardCache();

  // 3. Invalidate Next.js unstable_cache
  revalidateTag("leaderboard", {});
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const safe =
    Number.isFinite(concurrency) && concurrency > 0
      ? Math.floor(concurrency)
      : 1;
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(safe, items.length) }, worker)
  );
  return results;
}

async function fetchGitHubJson<T>(path: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error("[Leaderboard] GitHub request failed:", path, res.status);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("[Leaderboard] GitHub fetch error:", path, err);
    return null;
  }
}

function calculateCurrentStreak(commitDates: string[]): number {
  const days = Array.from(
    new Set(commitDates.map((d) => d.slice(0, 10)))
  ).sort();
  if (days.length === 0) return 0;

  let runLength = 1;
  const runs: { end: string; length: number }[] = [];
  for (let i = 1; i < days.length; i++) {
    if (dateDiffDays(days[i - 1], days[i]) === 1) {
      runLength++;
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

function getPeriodSince(period: LeaderboardPeriod): string | undefined {
  if (period === "all") {
    return undefined;
  }

  const days = period === "week" ? 7 : 30;
  return toDateStr(new Date(Date.now() - days * 86400000));
}

async function fetchCommitStats(username: string, since?: string) {
  const query = new URLSearchParams({
    q: [
      `author:${username}`,
      since ? `author-date:>=${since}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    per_page: "100",
    sort: "author-date",
    order: "desc",
  });
  return fetchGitHubJson<{
    total_count: number;
    items: Array<{ commit: { author: { date: string } } }>;
  }>(`/search/commits?${query}`);
}

async function fetchAllCommitDatesForStreak(
  username: string,
  since: string
): Promise<string[]> {
  const PER_PAGE = 100;
  const seenDays = new Set<string>();
  let page = 1;

  while (true) {
    const query = new URLSearchParams({
      q: `author:${username} author-date:>=${since}`,
      per_page: String(PER_PAGE),
      page: String(page),
      sort: "author-date",
      order: "desc",
    });

    const data = await fetchGitHubJson<{
      total_count: number;
      items: Array<{ commit: { author: { date: string } } }>;
    }>(`/search/commits?${query}`);

    if (!data || data.items.length === 0) break;

    for (const item of data.items) {
      seenDays.add(item.commit.author.date.slice(0, 10));
    }

    // Stop when we have fetched all available results
    if (page * PER_PAGE >= data.total_count || data.items.length < PER_PAGE) break;
    page++;
  }

  return Array.from(seenDays);
}

async function fetchPrCount(username: string, since?: string): Promise<number> {
  const query = new URLSearchParams({
    q: [
      `author:${username}`,
      "type:pr",
      since ? `created:>=${since}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    per_page: "1",
  });
  const data = await fetchGitHubJson<{ total_count: number }>(
    `/search/issues?${query}`
  );
  return data?.total_count ?? 0;
}

/**
 * Builds the leaderboard by calculating scores, streaks, commits, and PRs for all eligible users.
 * @param filters - Filtering options such as the period to build for.
 * @returns A promise resolving to the fully constructed leaderboard payload.
 */
export async function buildLeaderboard(
  filters: LeaderboardFilters = {}
): Promise<LeaderboardPayload> {
  const period = filters.period ?? DEFAULT_PERIOD;
  const periodStart = getPeriodSince(period);
  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, github_login, is_sponsor")
    .eq("is_public", true)
    .eq("leaderboard_opt_in", true)
    .limit(50);

  if (error) {
    console.error("[Leaderboard] Supabase error:", error);
    throw new Error("Failed to load leaderboard users");
  }

  const now = new Date();
  const streakStart = toDateStr(
    new Date(Date.now() - 365 * 86400000)
  );
  const safeUsers = (users ?? []) as PublicUser[];

  const rows = await mapWithConcurrency(
    safeUsers,
    USER_CONCURRENCY,
    async (user) => {
      const [monthlyCommits, streakDates, prs] = await Promise.all([
        fetchCommitStats(user.github_login, periodStart),
        fetchAllCommitDatesForStreak(user.github_login, streakStart),
        fetchPrCount(user.github_login, periodStart),
      ]);

      const streak = calculateCurrentStreak(streakDates);
      const commits = monthlyCommits?.total_count ?? 0;
      const score = streak * 5 + commits + prs * 3;

      return {
        id: user.id,
        rank: 0,
        username: user.github_login,
        avatarUrl: `https://github.com/${user.github_login}.png?size=96`,
        profileUrl: `/u/${user.github_login}`,
        streak,
        commits,
        prs,
        score,
        isSponsor: user.is_sponsor ?? false,
      };
    }
  );

  const rankBy = (metric: LeaderboardMetric) =>
    [...rows]
      .sort((a, b) => b[metric] - a[metric] || b.score - a.score)
      .slice(0, 50)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return {
    generatedAt: now.toISOString(),
    refreshSeconds: CACHE_REFRESH_SECONDS,
    leaders: {
      streak: rankBy("streak"),
      commits: rankBy("commits"),
      prs: rankBy("prs"),
    },
  };
}

/**
 * Forces a refresh of the leaderboard, caching the newly built payload.
 * @param filters - Filtering options.
 * @returns A promise resolving to the refreshed leaderboard payload.
 */
export async function refreshLeaderboardCache(
  filters: LeaderboardFilters = {}
): Promise<LeaderboardPayload> {
  const payload = await buildLeaderboard(filters);
  const period = filters.period ?? DEFAULT_PERIOD;
  const cacheKey = getLeaderboardCacheKey(period);
  await cacheSet(cacheKey, payload, CACHE_STALE_SECONDS);
  setMemoryCachedLeaderboard(payload, period);
  revalidateTag("leaderboard", {});
  return payload;
}

/**
 * Retrieves the cached leaderboard using Next.js unstable_cache, falling back to buildLeaderboard.
 * @param filters - Filtering options.
 * @returns A promise resolving to the leaderboard payload.
 */
export const getCachedLeaderboard = (filters: LeaderboardFilters = {}) => {
  const period = filters.period ?? DEFAULT_PERIOD;
  return unstable_cache(
    async () => buildLeaderboard(filters),
    ["leaderboard", period],
    {
      revalidate: CACHE_REFRESH_SECONDS,
      tags: ["leaderboard"],
    }
  )();
};

/**
 * Retrieves the leaderboard data, attempting memory cache, redis cache, and rebuild as fallbacks.
 * @param bypass - Whether to bypass the cache entirely and force a rebuild.
 * @param filters - Filtering options.
 * @returns A promise resolving to the leaderboard payload.
 */
export async function getLeaderboardData(
  bypass = false,
  filters: LeaderboardFilters = {}
): Promise<LeaderboardPayload | null> {
  const period = filters.period ?? DEFAULT_PERIOD;

  if (bypass) {
    try {
      const payload = await buildLeaderboard(filters);
      const cacheKey = getLeaderboardCacheKey(period);
      await cacheSet(cacheKey, payload, CACHE_STALE_SECONDS);
      setMemoryCachedLeaderboard(payload, period);
      return payload;
    } catch (err) {
      console.error("[Leaderboard] Build failed:", err);
      return null;
    }
  }

  try {
    return await getCachedLeaderboard(filters);
  } catch (err) {
    console.error("[Leaderboard] unstable_cache failed, falling back to custom cache:", err);

    const mem = getMemoryCachedLeaderboard(period);
    if (mem) return mem;

    const cached = await cacheGet<LeaderboardPayload>(getLeaderboardCacheKey(period));
    if (cached && isFresh(cached)) {
      setMemoryCachedLeaderboard(cached, period);
      return cached;
    }

    try {
      const payload = await buildLeaderboard(filters);
      const cacheKey = getLeaderboardCacheKey(period);
      await cacheSet(cacheKey, payload, CACHE_STALE_SECONDS);
      setMemoryCachedLeaderboard(payload, period);
      return payload;
    } catch (buildErr) {
      console.error("[Leaderboard] Fallback build failed:", buildErr);
      const stale = await cacheGet<LeaderboardPayload>(getLeaderboardCacheKey(period));
      return stale ?? null;
    }
  }
}

/**
 * Fetches the repositories associated with a user for a specific programming language.
 * @param username - The GitHub username.
 * @param language - The programming language to filter by.
 * @returns An array of repository full names.
 */
export async function fetchLanguageRepositories(
  username: string,
  language: string
): Promise<string[]> {
  const LANGUAGE_REPO_LIMIT = 8;
  const query = new URLSearchParams({
    q: `user:${username} language:${language}`,
    per_page: String(LANGUAGE_REPO_LIMIT),
    sort: "updated",
    order: "desc",
  });

  const data = await fetchGitHubJson<{
    items: Array<{ full_name: string }>;
  }>(`/search/repositories?${query.toString()}`);

  return data?.items.map((repo) => repo.full_name) ?? [];
}

/**
 * Filters an existing leaderboard payload to include only users active in a specific language.
 * @param leaderboard - The original leaderboard payload.
 * @param language - The programming language to filter by.
 * @returns A promise resolving to the filtered leaderboard payload.
 */
export async function filterLeaderboardByLanguage(
  leaderboard: LeaderboardPayload,
  language: string
): Promise<LeaderboardPayload> {
  const normalizedLanguage = language.trim().toLowerCase();
  if (!normalizedLanguage) {
    return leaderboard;
  }

  const filterEntries = async (
    entries: LeaderboardEntry[]
  ) => {
    const matches = await Promise.all(
      entries.map(async (entry) => {
        const repos = await fetchLanguageRepositories(
          entry.username,
          normalizedLanguage
        );
        return repos.length > 0 ? entry : null;
      })
    );

    return matches.filter(
      (entry): entry is LeaderboardEntry => entry !== null
    );
  };

  return {
    ...leaderboard,
    leaders: {
      streak: await filterEntries(leaderboard.leaders.streak),
      commits: await filterEntries(leaderboard.leaders.commits),
      prs: await filterEntries(leaderboard.leaders.prs),
    },
  };
}

