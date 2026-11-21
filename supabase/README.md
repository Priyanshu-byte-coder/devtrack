# Database setup and adoption

The active migration is `migrations/20261011000000_canonical_schema.sql`. Its SQL is identical to `schema.sql`. It creates the full 32-table schema, service-only functions, indexes and browser access restrictions. Historical migrations are preserved byte-for-byte in `legacy-migrations/`; the old bootstrap at commit `a20e51d` is preserved in `legacy-schema.sql`. Those files are provenance and test fixtures, not an active migration chain. Their duplicate versions and incompatible UUID references prevented deterministic replay.

## Migrations after the baseline

`schema.sql` stays byte-identical to the baseline migration, because the baseline has already been applied to production. Schema changes since then live only in later files in `migrations/` (14-digit version, after `20261011000000`), applied in version order:

| Version                                       | Adds                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `20261102000000_gamification.sql`             | `leaderboard_snapshots`, `user_progress` (with a trigger so XP, level, best tier and best rank never regress), `season_results` |
| `20261110000000_weekly_digest_default_on.sql` | `users.weekly_digest_opt_in` defaults to `true`, so new accounts get the weekly digest                                          |

**One-time data update for `20261110000000`.** Run once, right after that migration, to turn the digest on for accounts created before it. Don't run it again later, or it re-subscribes everyone who has unsubscribed since:

```sql
UPDATE public.users SET weekly_digest_opt_in = true WHERE weekly_digest_opt_in IS DISTINCT FROM true;
```

Each later migration must be safe to run twice and must give every new table RLS, revoked browser grants and service-role access; `pnpm run test:db` enforces both. The checks, type generator and route-contract checker all build the schema as baseline + later migrations.

## New installations

Run the active migration with Supabase CLI against a new database, or run **all** of `schema.sql` as one transaction in the Supabase SQL editor, followed by each later migration in version order. The Supabase roles `anon`, `authenticated` and `service_role` must exist. Then run the application with its service role credential configured only on the server.

NextAuth does not mint Supabase user JWTs. Every personal-data table has RLS enabled and grants revoked from both browser roles. Authenticated server APIs enforce ownership and room membership before the service role accesses data. Browser realtime subscriptions have been replaced by authenticated polling. Never grant the browser service-role access to restore subscriptions.

## Existing installations

1. Take a database snapshot, including `supabase_migrations.schema_migrations`. Restore it to a staging database first. Inventory real column types, constraints, grants, orphaned records and migration history there.
2. Apply `schema.sql` **inside one transaction** to staging. Existing tables and rows are retained. Known legacy UUID columns in `goal_history` and `milestones` are converted to text; dates become UTC timestamps and whole numeric activity counts become integers. Fractional/out-of-range history, unexpected core identity types, dependent legacy foreign keys or duplicate period/member records stop adoption rather than discard data. Reconcile those records explicitly before retrying.
3. New foreign keys for historical insight/note/CV/history data use `NOT VALID`: existing orphans are retained; new writes must reference a real owner. Map historical owners from verified records and validate the constraints when that reconciliation is complete. Do not assign orphan data to a different user just to satisfy a constraint.
4. Map existing `room_members.github_id` and `room_invitations.github_id` from independently verified GitHub account IDs. Existing display names are insufficient evidence. Unmapped rows remain inaccessible. Review duplicate memberships before the stable-ID unique indexes are applied. New rooms and invitations store verified IDs automatically. Reconcile `room_messages.sender_github_id` from verified authors too: legacy messages with unknown authors are preserved during account cleanup rather than deleted by a potentially recycled handle. Account deletion uses the service-only `delete_app_user` transaction, including owned rooms, stable-ID memberships and messages, and foreign-key cascades.
5. Reconcile the **actual remote migration history** with this squashed baseline using the Supabase migration tooling. Do not run `db reset`, blindly mark all legacy versions reverted, or blindly push through the historical collisions. Retain the snapshot and archived files so every applied historical change remains traceable. Mark `20261011000000` applied only after the complete SQL transaction succeeds. Subsequent migrations use unique 14-digit versions after this baseline.
6. Repeat the ownership, room invitation, recurring goal, webhook and scheduler checks in staging, then apply the reviewed transaction/history reconciliation to production. Sign in again after deployment so the primary GitHub token is stored encrypted for background sync. Keep the encryption key stable; changing it makes previously encrypted credentials unreadable.

Example transaction when using an SQL client:

```sql
BEGIN;
-- Execute the complete contents of schema.sql here.
COMMIT;
```

The repository changes have **not** applied SQL or migration-history mutations to any live database. The disposable PostgreSQL checks exercise both a fresh bootstrap and an upgrade containing real-shaped historical rows. They cannot establish which manual changes exist in a deployed Supabase project.

## Verification

```sh
pnpm run test:db
pnpm run supabase:generate-types
```

The first command verifies repeatability, browser grants/RLS, stable room identities, atomic invitation acceptance, recurring-goal rollover, account deletion rollback and preservation of legacy data. The second regenerates the checked-in contracts from disposable PostgreSQL, without reading live credentials.
