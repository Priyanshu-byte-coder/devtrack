import { supabaseAdmin } from "@/lib/supabase";
import { dateDiffDays, toDateStr } from "@/lib/date-utils";
import { cacheGet, cacheSet, invalidateLeaderboardCache } from "@/lib/metrics-cache";
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
export type LeaderboardTimeframe = "weekly" | "monthly" | "all_time";
export type LeaderboardPeriod = "week" | "month" | "all";

export interface LeaderboardFilters {
  timeframe?: LeaderboardTimeframe;
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

type LeaderboardSnapshotRow = {
  user_id: string;
  snapshot_at: string;
  commits: number | null;
  prs_merged: number | null;
};

type LeaderboardStreakRow = {
  user_id: string;
  snapshot_at: string;
  commits: number | null;
};

type LeaderboardAggregate = {
  commits: number;
  prs: number;
};

const LEGACY_PERIOD_TO_TIMEFRAME: Record<LeaderboardPeriod, LeaderboardTimeframe> = {
  week: "weekly",
  month: "monthly",
  all: "all_time",
};

const TIMEFRAME_TO_QUERY_DAYS: Record<Exclude<LeaderboardTimeframe, "all_time">, number> = {
  weekly: 7,
  monthly: 30,
};

const DEFAULT_TIMEFRAME: LeaderboardTimeframe = "weekly";

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
 * Generates the cache key for the leaderboard based on the given timeframe.
 * @param timeframe - The time period (e.g., 'weekly', 'monthly', 'all_time').
 * @returns The cache key string.
 */
export function getLeaderboardCacheKey(
  timeframe: LeaderboardTimeframe = DEFAULT_TIMEFRAME
): string {
  return `${LEADERBOARD_CACHE_KEY}:${timeframe}`;
}

export function normalizeLeaderboardTimeframe(
  value: string | null | undefined
): LeaderboardTimeframe | null {
  if (!value) {
    return null;
  }

  if (value === "weekly" || value === "monthly" || value === "all_time") {
    return value;
  }

  if (value in LEGACY_PERIOD_TO_TIMEFRAME) {
    return LEGACY_PERIOD_TO_TIMEFRAME[value as LeaderboardPeriod];
  }

  return null;
}

export function resolveLeaderboardTimeframe(
  filters: LeaderboardFilters = {}
): LeaderboardTimeframe {
  return (
    filters.timeframe ??
    (filters.period ? LEGACY_PERIOD_TO_TIMEFRAME[filters.period] : undefined) ??
    DEFAULT_TIMEFRAME
  );
}

/**
 * Retrieves the in-memory cached leaderboard payload, if it is fresh.
 * @param period - The time period (e.g., 'week', 'month', 'all').
 * @returns The cached payload, or null if missing or stale.
 */
export function getMemoryCachedLeaderboard(
  timeframe: LeaderboardTimeframe = DEFAULT_TIMEFRAME
): LeaderboardPayload | null {
  const cacheKey = getLeaderboardCacheKey(timeframe);
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
  timeframe: LeaderboardTimeframe = DEFAULT_TIMEFRAME
): void {
  const cacheKey = getLeaderboardCacheKey(timeframe);
  _memoryCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + CACHE_REFRESH_SECONDS * 1000,
  });
}

function getTimeframeCutoff(timeframe: LeaderboardTimeframe): string | undefined {
  if (timeframe === "all_time") {
    return undefined;
  }

  const days = TIMEFRAME_TO_QUERY_DAYS[timeframe];
  return toDateStr(new Date(Date.now() - days * 86400000));
}

function getStreakCutoff(): string {
  return toDateStr(new Date(Date.now() - 365 * 86400000));
}

async function fetchLeaderboardUsers(): Promise<PublicUser[]> {
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

  return (users ?? []) as PublicUser[];
}

async function fetchLeaderboardSnapshots(
  userIds: string[],
  since?: string
): Promise<LeaderboardSnapshotRow[]> {
  if (userIds.length === 0) {
    return [];
  }

  let query = supabaseAdmin
    .from("metric_snapshots")
    .select("user_id, snapshot_at, commits, prs_merged")
    .in("user_id", userIds)
    .order("snapshot_at", { ascending: false });

  if (since) {
    query = query.gte("snapshot_at", since);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[Leaderboard] Failed to load metric snapshots:", error);
    throw new Error("Failed to load leaderboard snapshots");
  }

  return (data ?? []) as LeaderboardSnapshotRow[];
}

async function fetchLeaderboardStreakSnapshots(
  userIds: string[]
): Promise<LeaderboardStreakRow[]> {
  return fetchLeaderboardSnapshots(userIds, getStreakCutoff());
}

function aggregateLeaderboardRows(
  metricRows: LeaderboardSnapshotRow[]
): Map<string, LeaderboardAggregate> {
  const aggregates = new Map<string, LeaderboardAggregate>();

  for (const row of metricRows) {
    const existing = aggregates.get(row.user_id) ?? { commits: 0, prs: 0 };
    existing.commits += row.commits ?? 0;
    existing.prs += row.prs_merged ?? 0;
    aggregates.set(row.user_id, existing);
  }

  return aggregates;
}

function aggregateStreakDays(
  streakRows: LeaderboardStreakRow[]
): Map<string, string[]> {
  const streakDays = new Map<string, Set<string>>();

  for (const row of streakRows) {
    if ((row.commits ?? 0) <= 0) {
      continue;
    }

    const day = toDateStr(new Date(row.snapshot_at));
    const existing = streakDays.get(row.user_id) ?? new Set<string>();
    existing.add(day);
    streakDays.set(row.user_id, existing);
  }

  return new Map(
    Array.from(streakDays.entries()).map(([userId, days]) => [
      userId,
      Array.from(days),
    ])
  );
}

function buildLeaderboardFromRows(
  users: PublicUser[],
  metricRows: LeaderboardSnapshotRow[],
  streakRows: LeaderboardStreakRow[]
): LeaderboardPayload {
  const now = new Date();
  const metricTotals = aggregateLeaderboardRows(metricRows);
  const streakDaysByUser = aggregateStreakDays(streakRows);

  const rows = users.map((user) => {
    const totals = metricTotals.get(user.id) ?? { commits: 0, prs: 0 };
    const streakDates = streakDaysByUser.get(user.id) ?? [];
    const streak = calculateCurrentStreak(streakDates);
    const score = streak * 5 + totals.commits + totals.prs * 3;

    return {
      id: user.id,
      rank: 0,
      username: user.github_login,
      avatarUrl: `https://github.com/${user.github_login}.png?size=96`,
      profileUrl: `/u/${user.github_login}`,
      streak,
      commits: totals.commits,
      prs: totals.prs,
      score,
      isSponsor: user.is_sponsor ?? false,
    };
  });

  const rankBy = (metric: LeaderboardMetric) =>
    [...rows]
      .sort((a, b) => b[metric] - a[metric] || b.score - a.score)
      .slice(0, 50)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

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

async function loadLeaderboardPayload(
  timeframe: LeaderboardTimeframe,
  options: { fullHistory?: boolean } = {}
): Promise<LeaderboardPayload> {
  const users = await fetchLeaderboardUsers();

  if (users.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      refreshSeconds: CACHE_REFRESH_SECONDS,
      leaders: { streak: [], commits: [], prs: [] },
    };
  }

  const userIds = users.map((user) => user.id);
  const [metricRows, streakRows] = await Promise.all([
    fetchLeaderboardSnapshots(
      userIds,
      options.fullHistory ? undefined : getTimeframeCutoff(timeframe)
    ),
    fetchLeaderboardStreakSnapshots(userIds),
  ]);

  return buildLeaderboardFromRows(users, metricRows, streakRows);
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

async function persistLeaderboardPayload(
  timeframe: LeaderboardTimeframe,
  payload: LeaderboardPayload
): Promise<void> {
  await cacheSet(getLeaderboardCacheKey(timeframe), payload, CACHE_STALE_SECONDS);
  setMemoryCachedLeaderboard(payload, timeframe);
}

async function upsertLeaderboardCacheRow(
  timeframe: LeaderboardTimeframe,
  payload: LeaderboardPayload
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CACHE_STALE_SECONDS * 1000).toISOString();

    await supabaseAdmin.from("leaderboard_cache").upsert(
      {
        key: getLeaderboardCacheKey(timeframe),
        payload,
        generated_at: now,
        expires_at: expiresAt,
        building_until: null,
        updated_at: now,
      },
      { onConflict: "key" }
    );
  } catch (error) {
    console.warn("[Leaderboard] Failed to persist cache row:", error);
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

/**
 * Builds the leaderboard for a single timeframe using snapshot data.
 * @param filters - Filtering options such as the timeframe to build for.
 * @returns A promise resolving to the fully constructed leaderboard payload.
 */
export async function buildLeaderboard(
  filters: LeaderboardFilters = {}
): Promise<LeaderboardPayload> {
  return loadLeaderboardPayload(resolveLeaderboardTimeframe(filters));
}

/**
 * Builds all leaderboard timeframes in a single pass so rebuild jobs can
 * refresh every cache partition without repeating the same SQL work.
 */
export async function refreshAllLeaderboardCaches(): Promise<{
  weekly: LeaderboardPayload;
  monthly: LeaderboardPayload;
  all_time: LeaderboardPayload;
}> {
  const users = await fetchLeaderboardUsers();

  if (users.length === 0) {
    const emptyPayload = {
      generatedAt: new Date().toISOString(),
      refreshSeconds: CACHE_REFRESH_SECONDS,
      leaders: { streak: [], commits: [], prs: [] },
    } satisfies LeaderboardPayload;

    await Promise.all(
      (["weekly", "monthly", "all_time"] as LeaderboardTimeframe[]).map(
        async (timeframe) => {
          await persistLeaderboardPayload(timeframe, emptyPayload);
          await upsertLeaderboardCacheRow(timeframe, emptyPayload);
        }
      )
    );

    revalidateTag("leaderboard", {});
    return {
      weekly: emptyPayload,
      monthly: emptyPayload,
      all_time: emptyPayload,
    };
  }

  const userIds = users.map((user) => user.id);
  const [metricRows, streakRows] = await Promise.all([
    fetchLeaderboardSnapshots(userIds),
    fetchLeaderboardStreakSnapshots(userIds),
  ]);

  const payloadFor = (timeframe: LeaderboardTimeframe) =>
    buildLeaderboardFromRows(
      users,
      timeframe === "all_time"
        ? metricRows
        : metricRows.filter((row) => {
            const cutoff = getTimeframeCutoff(timeframe);
            return cutoff ? new Date(row.snapshot_at).getTime() >= new Date(cutoff).getTime() : true;
          }),
      streakRows
    );

  const payloads = {
    weekly: payloadFor("weekly"),
    monthly: payloadFor("monthly"),
    all_time: payloadFor("all_time"),
  };

  await Promise.all(
    (Object.entries(payloads) as Array<
      [LeaderboardTimeframe, LeaderboardPayload]
    >).map(async ([timeframe, payload]) => {
      await persistLeaderboardPayload(timeframe, payload);
      await upsertLeaderboardCacheRow(timeframe, payload);
    })
  );

  revalidateTag("leaderboard", {});
  return payloads;
}

/**
 * Forces a refresh of a single leaderboard timeframe, caching the newly built payload.
 * @param filters - Filtering options.
 * @returns A promise resolving to the refreshed leaderboard payload.
 */
export async function refreshLeaderboardCache(
  filters: LeaderboardFilters = {}
): Promise<LeaderboardPayload> {
  const timeframe = resolveLeaderboardTimeframe(filters);
  const payload = await buildLeaderboard({ timeframe });
  await persistLeaderboardPayload(timeframe, payload);
  await upsertLeaderboardCacheRow(timeframe, payload);
  revalidateTag("leaderboard", {});
  return payload;
}

/**
 * Retrieves the cached leaderboard using Next.js unstable_cache, falling back to buildLeaderboard.
 * @param filters - Filtering options.
 * @returns A promise resolving to the leaderboard payload.
 */
export const getCachedLeaderboard = (filters: LeaderboardFilters = {}) => {
  const timeframe = resolveLeaderboardTimeframe(filters);
  return unstable_cache(
    async () => buildLeaderboard({ timeframe }),
    ["leaderboard", timeframe],
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
  const timeframe = resolveLeaderboardTimeframe(filters);

  if (bypass) {
    try {
      const payload = await buildLeaderboard({ timeframe });
      await persistLeaderboardPayload(timeframe, payload);
      return payload;
    } catch (err) {
      console.error("[Leaderboard] Build failed:", err);
      return null;
    }
  }

  try {
    return await getCachedLeaderboard({ timeframe });
  } catch (err) {
    console.error("[Leaderboard] unstable_cache failed, falling back to custom cache:", err);

    const mem = getMemoryCachedLeaderboard(timeframe);
    if (mem) return mem;

    const cached = await cacheGet<LeaderboardPayload>(getLeaderboardCacheKey(timeframe));
    if (cached && isFresh(cached)) {
      setMemoryCachedLeaderboard(cached, timeframe);
      return cached;
    }

    try {
      const payload = await buildLeaderboard({ timeframe });
      await persistLeaderboardPayload(timeframe, payload);
      return payload;
    } catch (buildErr) {
      console.error("[Leaderboard] Fallback build failed:", buildErr);
      const stale = await cacheGet<LeaderboardPayload>(getLeaderboardCacheKey(timeframe));
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

