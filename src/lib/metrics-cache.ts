import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

export const METRICS_CACHE_TTL_SECONDS = {
  contributions: 5 * 60,
  "productive-hours": 5 * 60,
  discussions: 10 * 60,
  repos: 10 * 60,
  "pinned-repos": 10 * 60,
  "inactive-repos": 10 * 60,
  prs: 10 * 60,
  "pr-review-time": 10 * 60,
  insights: 10 * 60,
  streak: 2 * 60,
  streak_freeze: 2 * 60,
  activity: 5 * 60,
  issues: 10 * 60,
  languages: 21600,
  "coding-activity-insights": 30 * 60,
  compare: 30 * 60,
  "weekly-summary": 30 * 60,
  "commit-times": 30 * 60,
  // 2 hours TTL for historical achievements because they do not require real-time updates
  "achievement-progress": 2 * 60 * 60,
} as const;

type MetricsCacheEndpoint = keyof typeof METRICS_CACHE_TTL_SECONDS;
type CacheParamValue = boolean | number | string | null | undefined;
type MemoryCacheEntry = { value: unknown; expiresAt: number };
export const DEFAULT_METRICS_STALE_GRACE_SECONDS = 24 * 60 * 60;

export type MetricsCacheOptions = {
  bypass: boolean;
  key: string;
  ttlSeconds: number;
  staleGraceSeconds?: number;
  fallbackToStaleOnError?: (error: unknown) => boolean;
};

function staleMetricsCacheKey(key: string): string {
  return `${key}:stale`;
}

let redisClient: Redis | null | undefined;
const MAX_MEMORY_CACHE_ENTRIES = 500;

/* ============================================================
   Persists across Next.js Fast Refresh in local development
   ============================================================ */
const globalForCache = globalThis as unknown as {
  metricsMemoryCache?: Map<string, MemoryCacheEntry>;
};

const memoryCache =
  globalForCache.metricsMemoryCache ?? new Map<string, MemoryCacheEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForCache.metricsMemoryCache = memoryCache;
}

function ensureMemoryCacheCapacity(): void {
  while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    memoryCache.delete(oldestKey);
  }
}

function isValidTtl(ttlSeconds: number): boolean {
  return Number.isFinite(ttlSeconds) && ttlSeconds > 0;
}

function getMemoryCacheValue<T>(key: string): T | null {
  const hit = memoryCache.get(key);
  if (!hit) {
    return null;
  }

  if (hit.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  memoryCache.delete(key);
  memoryCache.set(key, hit);
  return hit.value as T;
}

function setMemoryCacheValue<T>(
  key: string,
  value: T,
  ttlSeconds: number
): void {
  if (!isValidTtl(ttlSeconds)) {
    return;
  }

  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  ensureMemoryCacheCapacity();
}

function isTruthyCacheBypass(value: string | null): boolean {
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Retrieves the singleton Redis client instance for caching metrics.
 * @returns The Upstash Redis client or null if not configured.
 */
export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

/**
 * Checks if the metrics cache should be bypassed based on request parameters or headers.
 * @param req - The Next.js request object.
 * @returns True if cache bypass is requested.
 */
export function isMetricsCacheBypassed(req: NextRequest): boolean {
  const bypassParam =
    req.nextUrl.searchParams.get("refresh") ??
    req.nextUrl.searchParams.get("bypassCache") ??
    req.nextUrl.searchParams.get("sync");
  const bypassHeader = req.headers.get("x-devtrack-cache-bypass");

  return isTruthyCacheBypass(bypassParam) || isTruthyCacheBypass(bypassHeader);
}

/**
 * Constructs a unique cache key for a given metrics endpoint, user, and arbitrary parameters.
 * @param userId - The ID of the user.
 * @param endpoint - The metrics endpoint key.
 * @param params - Additional parameters to uniquely identify the request.
 * @returns The constructed cache key string.
 */
export function metricsCacheKey(
  userId: string,
  endpoint: MetricsCacheEndpoint,
  params: Record<string, CacheParamValue> = {}
): string {
  const cacheParams = new URLSearchParams();

  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .forEach(([key, value]) => cacheParams.set(key, String(value)));

  return `metrics:${userId}:${endpoint}:${cacheParams.toString() || "default"}`;
}

/**
 * Retrieves a cached value, checking in-memory first and falling back to Redis.
 * @param key - The cache key.
 * @param ttlSeconds - Optional TTL to refresh the in-memory cache if a Redis hit occurs.
 * @returns A promise resolving to the cached value, or null if a cache miss.
 */
export async function cacheGet<T>(
  key: string,
  ttlSeconds?: number
): Promise<T | null> {
  const memoryValue = getMemoryCacheValue<T>(key);
  if (memoryValue !== null) {
    return memoryValue;
  }

  const redis = getRedisClient();

  if (redis) {
    try {
      const redisValue = await redis.get<T>(key);
      if (redisValue !== null && ttlSeconds !== undefined) {
        setMemoryCacheValue(key, redisValue, ttlSeconds);
      }
      return redisValue;
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * Stores a value in both the in-memory cache and Redis with a specific TTL.
 * @param key - The cache key.
 * @param value - The value to store.
 * @param ttlSeconds - The time-to-live in seconds.
 * @returns A promise that resolves when caching completes.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (!isValidTtl(ttlSeconds)) {
    return;
  }

  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (e) {
      // Cache failures must not break dashboard metrics.
    }
  }

  setMemoryCacheValue(key, value, ttlSeconds);
}

/**
 * Helper to fetch fresh data and cache it, or return cached data if available and not bypassed.
 * @param options - Bypassing, key, and TTL options.
 * @param loadFresh - A callback to load fresh data on a cache miss.
 * @returns A promise resolving to the data.
 */
export async function withMetricsCache<T>(
  options: MetricsCacheOptions,
  loadFresh: () => Promise<T>
): Promise<T> {
  let staleValue: T | null = null;

  if (!options.bypass) {
    const cached = await cacheGet<T>(options.key, options.ttlSeconds);

    if (cached !== null) {
      return cached;
    }

    if (options.fallbackToStaleOnError) {
      staleValue = await cacheGet<T>(staleMetricsCacheKey(options.key));
    }
  }

  try {
    const fresh = await loadFresh();

    await cacheSet(options.key, fresh, options.ttlSeconds);

    if (options.fallbackToStaleOnError) {
      const staleGraceSeconds =
        options.staleGraceSeconds ?? DEFAULT_METRICS_STALE_GRACE_SECONDS;

      if (Number.isFinite(staleGraceSeconds) && staleGraceSeconds > 0) {
        await cacheSet(
          staleMetricsCacheKey(options.key),
          fresh,
          options.ttlSeconds + staleGraceSeconds
        );
      }
    }

    return fresh;
  } catch (error) {
    if (staleValue !== null && options.fallbackToStaleOnError?.(error)) {
      return staleValue;
    }

    throw error;
  }
}

/**
 * Removes a single cache key from both the in-process memory store and Redis.
 * Used to evict a specific entry (e.g. the shared leaderboard key) without
 * scanning all keys the way invalidateUserMetricsCache does for per-user data.
 */
export async function cacheDelete(key: string): Promise<void> {
  const keys = [key, staleMetricsCacheKey(key)];

  for (const cacheKey of keys) {
    memoryCache.delete(cacheKey);
  }

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(...keys);
  } catch {
    // Cache invalidation failures must not surface to callers.
  }
}

/**
 * Evicts all cached metric keys associated with a specific user from memory and Redis.
 * @param userId - The user's ID whose metrics should be invalidated.
 * @returns A promise that resolves when the invalidation is complete.
 */
export async function invalidateUserMetricsCache(userId: string): Promise<void> {
  const prefix = `metrics:${userId}:`;

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  const redis = getRedisClient();
  if (!redis) return;

  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      });
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = Number(nextCursor);
    } while (cursor !== 0);
  } catch (e) {
    // Invalidation failures must not break the webhook response.
  }
}

export async function invalidateLeaderboardCache(): Promise<void> {
  const prefix = `leaderboard:`;

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }

  const redis = getRedisClient();
  if (!redis) return;

  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      });
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      cursor = Number(nextCursor);
    } while (cursor !== 0);
  } catch (e) {
    // Invalidation failures must not break the settings/webhook response.
  }
}
