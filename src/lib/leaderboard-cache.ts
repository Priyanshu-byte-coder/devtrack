export type LeaderboardCacheEntry<T> = {
  expiresAt: number;
  payload: T;
};

export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export function pruneExpiredLeaderboardCache<T>(
  entry: LeaderboardCacheEntry<T> | null | undefined,
  now: number = Date.now()
): LeaderboardCacheEntry<T> | null {
  if (!entry || !Number.isFinite(entry.expiresAt)) {
    return null;
  }
  return entry.expiresAt <= now ? null : entry;
}

export function pruneExpiredRateLimits(
  buckets: Map<string, RateLimitEntry>,
  now: number = Date.now()
): void {
  for (const [key, record] of buckets) {
    if (!record || !Number.isFinite(record.resetAt) || record.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
