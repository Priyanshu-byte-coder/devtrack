# Caching in DevTrack

DevTrack uses a multi-layer caching strategy to reduce GitHub API pressure, improve dashboard load times, and stay within Vercel's serverless function budgets.

---

## Layer 1: Server-side metrics cache (`src/lib/metrics-cache.ts`)

This is the primary caching layer for all `/api/metrics/*` routes.

### How it works

The cache is two-tiered:

1. **In-process memory** — a `Map<string, { value, expiresAt }>` that persists across requests within the same serverless instance. Capped at 500 entries (LRU eviction).
2. **Upstash Redis** — when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, the cache also reads from and writes to Redis. This makes the cache effective across multiple Vercel instances (e.g. during traffic spikes). The app degrades gracefully to memory-only if Redis is not configured.

### The `withMetricsCache` pattern

Every metrics route uses this helper:

```ts
import { withMetricsCache, metricsCacheKey, isMetricsCacheBypassed } from "@/lib/metrics-cache";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bypass = isMetricsCacheBypassed(req);

  const data = await withMetricsCache(
    {
      bypass,
      key: metricsCacheKey(userId, "streak"),
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.streak,
    },
    () => fetchStreakFromGitHub(session.accessToken)
  );

  return NextResponse.json(data);
}
```

On a cache hit, `withMetricsCache` returns the stored value without calling the loader. On a miss, it calls the loader, stores the result, and returns it.

### Stale fallback

Routes can opt into stale fallback on error:

```ts
withMetricsCache(
  {
    bypass,
    key,
    ttlSeconds,
    fallbackToStaleOnError: (err) => isGitHubRateLimitError(err),
  },
  loadFresh
)
```

A stale copy is stored alongside the primary entry with TTL = `ttlSeconds + staleGraceSeconds` (default: 24 hours). If the fresh fetch throws and `fallbackToStaleOnError` returns `true`, the stale value is returned rather than surfacing an error to the user.

### Per-endpoint TTLs

```ts
export const METRICS_CACHE_TTL_SECONDS = {
  contributions:             5 * 60,   //  5 minutes
  "productive-hours":        5 * 60,
  activity:                  5 * 60,
  streak:                    2 * 60,   //  2 minutes
  streak_freeze:             2 * 60,
  repos:                    10 * 60,   // 10 minutes
  prs:                      10 * 60,
  "pr-review-time":         10 * 60,
  issues:                   10 * 60,
  "pinned-repos":           10 * 60,
  "inactive-repos":         10 * 60,
  "achievement-progress":   10 * 60,
  discussions:              10 * 60,
  "weekly-summary":         30 * 60,   // 30 minutes
  "coding-activity-insights": 30 * 60,
  compare:                  30 * 60,
  "commit-times":           30 * 60,
  languages:               21600,      //  6 hours
};
```

### Cache key structure

```
metrics:{userId}:{endpoint}:{sorted-query-params}
```

Examples:
```
metrics:user_abc:streak:default
metrics:user_abc:contributions:days=30
metrics:user_abc:compare:target=octocat
```

### Cache bypass

A request can bypass the cache by including:
- Query parameter: `?refresh=1`, `?bypassCache=1`, or `?sync=1`
- Header: `x-devtrack-cache-bypass: 1`

### Cache invalidation

When a GitHub push webhook arrives at `/api/webhooks/github`, the handler calls `invalidateUserMetricsCache(userId)`, which:
1. Evicts all `metrics:{userId}:*` entries from the in-process map.
2. Scans and deletes matching keys from Redis (using `SCAN` to avoid blocking).

The leaderboard cache is invalidated separately via `invalidateLeaderboardCache()`, which evicts all `leaderboard:*` keys.

---

## Layer 2: Leaderboard cache (`src/lib/leaderboard-cache.ts`)

The leaderboard is expensive to build — it aggregates GitHub activity for every public DevTrack user. To avoid rebuilding it on every request, results are cached in the Supabase `leaderboard_cache` table.

`src/lib/leaderboard-cache.ts` exports helpers for working with cache entries:

```ts
export type LeaderboardCacheEntry<T> = {
  expiresAt: number;
  payload: T;
};

// Returns null if the entry is expired
export function pruneExpiredLeaderboardCache<T>(
  entry: LeaderboardCacheEntry<T> | null | undefined,
  now: number = Date.now()
): LeaderboardCacheEntry<T> | null
```

The leaderboard route reads the cached entry from Supabase. If the entry is missing or expired, it triggers a rebuild and stores the result with a new `expiresAt` timestamp. The `/api/leaderboard/rebuild` endpoint (protected by `LEADERBOARD_REBUILD_TOKEN`) forces a full rebuild regardless of cache state.

---

## Layer 3: Response-level `Cache-Control` headers (`src/lib/response-cache.ts`)

Authenticated metric routes return user-specific data that must not be cached at the CDN edge. However, the browser can cache them privately to avoid redundant function invocations on tab switches and soft navigations.

```ts
import { privateCacheHeaders, publicCacheHeaders } from "@/lib/response-cache";

// Authenticated endpoints: private browser cache only
return NextResponse.json(data, {
  headers: privateCacheHeaders(300),  // Cache-Control: private, max-age=300, stale-while-revalidate=600
});

// Public endpoints (e.g. /api/public/[username], /api/leaderboard): CDN-cacheable
return NextResponse.json(data, {
  headers: publicCacheHeaders(300),   // Cache-Control: public, s-maxage=300, stale-while-revalidate=600
});
```

---

## Layer 4: Upstash Redis helper (`src/lib/redis-cache-helper.ts`)

A thin wrapper used in routes that need direct Redis access outside the metrics cache abstraction:

```ts
import { getCachedData, setCachedData } from "@/lib/redis-cache-helper";

const cached = await getCachedData<MyType>("my-key");
if (!cached) {
  const fresh = await computeExpensiveThing();
  await setCachedData("my-key", fresh, 300); // 5-minute TTL
}
```

Returns `null` (rather than throwing) if Redis is not configured or if a Redis error occurs.

---

## GitHub API fetch caching

All GitHub API calls in DevTrack use `cache: "no-store"` on the underlying `fetch`:

```ts
const res = await fetch("https://api.github.com/...", {
  headers: { Authorization: `Bearer ${token}` },
  cache: "no-store",
});
```

This prevents Next.js from deduplicating or caching responses across requests — important because different users have different OAuth tokens, and staling a response with one user's token for another user would leak data or cause subtle bugs.

The server-side metrics cache (Layer 1) is the correct mechanism for reuse across requests; Next.js fetch caching is explicitly disabled for GitHub calls.

---

## Summary

| Layer | Location | Scope | Backend |
|---|---|---|---|
| Metrics cache | `src/lib/metrics-cache.ts` | Per user, per endpoint | Memory + Upstash Redis (optional) |
| Leaderboard cache | `src/lib/leaderboard-cache.ts` | Global leaderboard result | Supabase table |
| HTTP Cache-Control | `src/lib/response-cache.ts` | Per response | Browser (private) or CDN (public) |
| Redis helper | `src/lib/redis-cache-helper.ts` | Ad-hoc keys | Upstash Redis (optional) |
| GitHub fetch | Route handlers | Disabled | `cache: "no-store"` |
