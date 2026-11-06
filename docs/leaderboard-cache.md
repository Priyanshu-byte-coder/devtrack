# Leaderboard caching

Building the leaderboard means a GitHub request per public player, so the result is cached in several layers. This page explains them, how changes reach the board, and the optional scheduled rebuild.

## Layers

| Layer                        | Where                                                | Notes                                                                           |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Next.js data cache           | `getCachedLeaderboard()` in `src/lib/leaderboard.ts` | `unstable_cache`, tag `leaderboard`, refreshed hourly (`CACHE_REFRESH_SECONDS`) |
| In-process memory            | `src/lib/leaderboard.ts`                             | Fallback when the data cache fails; per server instance                         |
| Shared cache (Redis/Upstash) | `src/lib/metrics-cache.ts`                           | Optional; stale copies for up to 6 hours (`CACHE_STALE_SECONDS`)                |
| `leaderboard_cache` table    | Supabase (in the baseline schema)                    | Written by the rebuild endpoint; lets any instance serve a recent payload       |

`GET /api/leaderboard` reports which layer answered in the `x-devtrack-leaderboard-cache` response header (`memory`, `stale`, `error-stale`...).

## How changes reach the board

When a player turns their public profile or the leaderboard on or off (Settings), and when a new player signs in for the first time, `clearLeaderboardCache()` drops every layer and expires the `leaderboard` tag with `revalidateTag("leaderboard", { expire: 0 })`. The next request rebuilds the board, so the change is visible straight away.

Use `{ expire: 0 }` for this tag. An object without `expire` (or a profile like `"max"`) means stale-while-revalidate: the first visitor after the change would still see the old board. `test/leaderboard-tag-expiry.test.ts` guards this.

Ranks on README badges and share cards come from the daily snapshots written by `/api/cron/gamification`, so they can lag the live board by up to a day.

## Scheduled rebuild (optional)

For large installations you can keep the `leaderboard_cache` table warm with a scheduled rebuild:

1. Set `LEADERBOARD_REBUILD_TOKEN` (a long random secret) and the Supabase server variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Call the endpoint from your scheduler:

```bash
curl -X POST "https://<your-site>/api/leaderboard/rebuild" \
  -H "x-devtrack-rebuild-token: $LEADERBOARD_REBUILD_TOKEN"
```

Every 15–60 minutes is plenty; builds are de-duplicated within a process. `LEADERBOARD_USER_CONCURRENCY` (default 5) limits concurrent GitHub fetches during a build.

## Verifying

- After a rebuild, the `leaderboard_cache` row has a fresh `payload` and `generated_at`.
- Toggle the leaderboard setting on a test account and reload `/leaderboard` once: the change should show on that first load.
