# Leaderboard cache: implementation & deployment notes

This change implements a persistent, cross-instance leaderboard cache and safe rebuild workflow.

What changed

- Added `leaderboard_cache` table migration: `supabase/migrations/20260602000000_add_leaderboard_cache.sql`.
- Updated API route: `src/app/api/leaderboard/route.ts` to read from `leaderboard_cache`, return stale payloads, and attempt cross-instance locking using `building_until`.
- Added secure scheduled rebuild endpoint: `src/app/api/leaderboard/rebuild/route.ts`.
- Added in-process dedupe to avoid duplicate builds within the same Node process.

Required deployment steps

1. Apply the new database migration in your Supabase project (use SQL editor or CLI):

```bash
# Example using psql (replace with your connection info)
psql -h <host> -U <user> -d <db> -f supabase/migrations/20260602000000_add_leaderboard_cache.sql
```

2. Set environment variables in your deployment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEADERBOARD_REBUILD_TOKEN` (secret value used by scheduled job)

3. Configure a scheduler (cron/CI) to POST the rebuild endpoint periodically:

```bash
curl -X POST "https://<your-site>/api/leaderboard/rebuild" \
  -H "x-devtrack-rebuild-token: $LEADERBOARD_REBUILD_TOKEN"
```

Recommended frequency: every 5–15 minutes depending on how fresh you want the leaderboard.

Verification

- After running the rebuild endpoint, verify `leaderboard_cache` row exists in the DB and contains `payload` and `generated_at`.
- Send concurrent requests to `/api/leaderboard` and verify `x-devtrack-leaderboard-cache` header values (`supabase`, `stale-supabase`, etc.) and that only one rebuild occurs (check logs).

Notes & follow-ups

- The DB lock uses a time window (`building_until`). For long builds you may want to extend the lock during the build or use a more robust job runner.
- Add tests to simulate concurrent requests and assert only one build occurs. This PR includes code changes but no test changes.
