## Summary

DevTrack's GitHub requests could repeat concurrently, exhaust quota, return generic failures, and turn incomplete upstream data into misleading statistics. The audit also found unauthorized weekly/paid-AI calls, provider tokens in browser sessions, room authorization based on mutable names, incompatible database setup/migrations, unsafe webhook resolution, private PWA caches, and verification/deployment drift.

This draft implements the local code/configuration repairs and publishes the complete audit, repair ledger, regression evidence, and continuation instructions for Claude. **29 of 31 audit areas have implemented local repairs; AUD-30 and AUD-31 retain partial documentation/refactoring work. Live schema adoption, hosted verification and deployment remain pending.** These counts describe audit dispositions, not an overall deployment percentage.

- Repository/account: `Priyanshu-byte-coder/devtrack` / `Priyanshu-byte-coder`.
- Base: `main`, audited SHA `a20e51d437a220db4e626a072a9716b67381eca9`; origin/main still matched that SHA when preparing this PR on 2026-10-14.
- Head: `fix/audit-and-github-reliability`.
- Original audit: 2026-10-11; all 39 remote branches and two tags were fetched; the point-in-time backlog included 124 open issues and 23 open PRs. This PR does not merge those branches/PRs or automatically close historical issues.
- Prior full validation: 2026-10-11. Database/schema upgrades, generated types, 487 query contracts, API methods/security, imports, environment scanner and the patched dependency audit all passed fresh rechecks on 2026-10-14 during PR preparation. Full unit/browser/build counts below are dated evidence; they are not presented as new full-suite runs.
- No live database SQL/history mutation, production deployment, issue closure or PR merge has been performed.

## Type of Change

- [x] Bug fixes
- [x] Security fixes
- [x] Performance/reliability improvements
- [x] Documentation and regression coverage
- [x] Refactoring and generated contracts
- [x] Breaking contract changes requiring coordinated database/deployment adoption

## Start here

1. [Original audit and all 31 findings](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/audits/2026-10-11/README.md).
2. [Architecture/context](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/audits/2026-10-11/CONTEXT.md) and [API/table/migration/environment inventory](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/audits/2026-10-11/INVENTORY.md).
3. [Repair ledger with dispositions and evidence](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/2026-10-11.md).
4. [Claude continuation handoff](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/CLAUDE_HANDOFF.md).
5. [Database adoption guide](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/supabase/README.md) before applying any SQL.
6. [GitHub backlog/failed-check context](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/audits/2026-10-11/GITHUB_BACKLOG.md) and [Original dependency advisories](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/audits/2026-10-11/DEPENDENCIES.md).

## What Changed

### GitHub request handling and metric accuracy

- `src/lib/github-request.ts` is the shared server-only GitHub API transport. Identical GET/read-only GraphQL reads share in-flight work and independently readable responses. Successful responses have a 30-second freshness window, retained responses support ETag/304 revalidation, cache keys hash credentials, and raw tokens never enter Redis keys.
- Outbound requests serialize per credential within each process. Queue/network work has a 12-second deadline. One caller aborting does not cancel shared read work. A timed-out queued caller cannot remove the active predecessor's queue chain.
- Primary cooldowns are resource-specific for core/search/GraphQL. Secondary cooldowns cover the credential. 403 permission failures remain permission failures; 429, Retry-After seconds/dates, reset headers, and HTTP-200 GraphQL RATE_LIMITED errors become cooldown responses. GraphQL primary resets preserve usable REST quota. API routes return canonical 429/Retry-After instead of generic failures.
- Redis shares caches/cooldowns when configured; memory is a bounded fallback. Single-flight/serialization remain process-local. GitHub quotas still apply; the implementation has no distributed request lock. Redis requests have deadlines and automatic retries disabled.
- Redirects are bounded and limited to the same `api.github.com` authority; credentials cannot follow redirects to arbitrary destinations.
- `github-search.ts` provides bounded collection: up to 10 pages/1,000 items and a time budget, with completeness/partialReason/retryAfter metadata. Contributions, top repos and PR breakdown show partial-data notices. Custom date windows, repository filters and cache parameters are validated. Language metrics honor the requested days.
- `streak-data.ts` shares the 365-day/timezone/freeze-aware model. Incomplete histories cannot award milestones. Public profiles/badges use public activity, so private dashboard totals can legitimately differ.
- `goals-sync.ts` uses canonical repo filters and exact search total_count for all six activity-derived units. Counts are checked before database writes, periods/creation bounds are respected, writes are owner filtered, and partial upstream results cannot overwrite progress. Cron rollover is atomic and archives periods even when the dashboard is never opened.
- `insight-metrics.ts` invokes metric handlers in-process and rejects non-success/missing/partial data before paid AI generation or persistence. Weekly webhook summaries use checked exact GitHub totals instead of summing cumulative snapshots or substituting zeroes.

### Authentication, rooms, webhooks and AI

- `server-session.ts` wraps the server session and encrypted HttpOnly JWT cookie, including secure/plain names and chunked cookies, with stable identity/revocation checks. GitHub/GitLab credentials remain server-only; public NextAuth session JSON has no provider tokens. All server consumers migrate together. The existing repo scope remains for private analytics.
- Room ownership, memberships and invitations use stable GitHub IDs. Invitation handles are resolved against GitHub. A service-only locked RPC handles acceptance/replay. Member removal survives renamed/recycled handles; pending invitations are not optimistic members.
- Room messages poll authenticated APIs with timestamp+UUID cursors, tie ordering, abort/no-overlap and independent cursor progression. Supabase browser subscriptions are replaced with authenticated polling because NextAuth does not issue Supabase user JWTs.
- Bulk weekly webhooks require strict cron authorization; manual POST is authenticated/owner scoped. Leases, keyset batches and persisted cursors bound scheduled work. Malformed bodies are rejected and destination/provider details are redacted.
- `safe-webhook-fetch.ts` validates all resolved addresses and pins the checked address in the connection while preserving TLS hostname verification. It rejects embedded credentials, redirects and unsafe Host overrides, bounds DNS/connection/response work, and separates IPv4/IPv6 block lists. Legacy/Discord/custom dispatch/test/retry share the transport.
- Paid roast/insight calls use authentication, bounded input, provider deadlines and atomic Redis quotas: 10 calls/user/hour and 500 globally/hour. Production fails closed with 503 when quota storage is unavailable; local development can use memory.
- Account deletion uses the identity-checked `delete_app_user` transaction. Owned rooms, stable-ID messages/memberships/invitations and FK-owned data are cleaned atomically. Errors roll back earlier deletes and preserve other users. Plain/secure session-cookie chunks expire after success. Export query failures return 503 rather than empty successful downloads.

### Database, PWA, runtime and CI

- `schema.sql` and the single active `20261011000000_canonical_schema.sql` are identical complete 32-table definitions. All tables enable RLS and revoke direct anon/authenticated table access; server APIs enforce ownership using the service role. Service-only RPCs include invitation acceptance, cron leasing, goal rollover and account deletion.
- All 56 historical migrations remain unchanged under `supabase/legacy-migrations/`; they are archived provenance, not an active chain. The original bootstrap is `legacy-schema.sql`. Known UUID/date/whole-numeric variants are upgraded without deleting fixture history. Unexpected identities, fractional/out-of-range data, duplicate periods/memberships or incompatible dependent FKs stop adoption. NOT VALID constraints retain existing orphaned history while checking new writes.
- One typed service client uses generated Row/Insert/Update/FK/view/RPC contracts. Missing configuration fails visibly. Disposable PostgreSQL verifies fresh/repeated bootstrap, legacy upgrade, RLS/grants, identity/RPC isolation and rollback. An AST selector/filter/order gate catches stale PostgREST columns that mocks accept.
- Next 16 uses `proxy.ts`, the shared trusted-IP policy, protocol-correct session cookies and per-response nonces. Scripts hydrate without production unsafe-inline/eval, worker-src allows the worker, and personal responses/pages are private/no-store.
- Webpack builds generate the installed PWA plugin's worker. Workbox settings are correctly nested under workboxOptions. API/document routes use NetworkOnly; navigation may serve only the shared public offline page; runtime caches are static/fonts only. Legacy private caches/background-sync/IndexedDB are cleaned. About 102 MB of demo GIFs and exported/docs assets are excluded from installation precaching. `check-pwa.mjs` inspects generated worker strategies and the actual offline fallback hook.
- ContributionGraph no longer persists personal data to IndexedDB and clears memory on identity/query changes. Offline UI wording is accurate. Non-Vercel hosts avoid unavailable telemetry scripts and auth links avoid automatic sign-in prefetch.
- Node 22.12 through 22.x and pnpm 11.13.1 align across manifest, lockfile, CI, Docker/Render and docs. Frozen install was validated. Production Compose supplies public build args; private credentials remain runtime-only. Standalone asset copy fails on missing/copy errors.
- Next 16.3.8 and compatible dependency updates/overrides remove the original unmitigated advisory set. Two exact-version registry advisories remain covered by reviewed braces/sprintf-js patches; `patches/security.json` pins versions/hashes and installed regression checks gate the exception. A raw registry audit is not zero-advisory. Re-audit before merge.
- CI requires coverage/Node/database/security/API/import checks, enforces a 30% line baseline and uploads coverage. Automation handles bots, pagination and assignment permission failures. Deprecated duplicate typecheck workflow is removed. Hosted checks still need to run on this branch.
- Source-derived OpenAPI covers 109 paths/143 operations, including route.tsx, correct methods, path parameters and cookie/cron/local-coding/rebuild/webhook authorizers. Generic operations explicitly mark missing expanded endpoint JSON schemas.
- All nine file-wide @ts-nocheck directives are removed, database clients/contracts are typed, StreakTracker state moves to a hook, shared services replace duplicated logic, and existing lint/encoding defects are corrected. noImplicitAny remains disabled and larger modules need incremental refactoring.

## Finding-by-finding disposition

?Implemented? means a local implementation with the verification scope below. Hosted/database effects still require adoption/deployment. The last two findings retain explicit partial work.

| Finding | Disposition | Changes and verification |
|---|---|---|
| AUD-01 weekly authorization | Implemented | Cron-only bulk GET; owner-only manual POST; malformed bodies rejected; recipient URLs and provider bodies redacted; bounded batches with persisted lease/cursor. `weekly-notifications-security.test.ts`. |
| AUD-02 room identities | Implemented; legacy mapping required | Ownership/membership/invitations use stable GitHub IDs; verified invitation lookup; atomic locked invitation RPC with replay protection; renamed-owner/member checks; pending invites remain pending in UI. Database identity tests and room API regressions. |
| AUD-03 public provider credentials | Implemented | Public NextAuth sessions omit GitHub/GitLab tokens; all server consumers use a server-only cookie/token boundary; identity/revocation guards; nonce CSP. Server session tests and production browser session canaries. |
| AUD-04 dependencies | Implemented with two verified local patches | Next 16.3.8 and compatible vulnerable dependency updates/overrides; pinned patched braces/sprintf-js implementations. The raw registry still reports two exact-version advisories; patch hashes and installed regression tests are mandatory in the audit gate. `patches/security.json` and `dependency-audit.json`. |
| AUD-05 RLS | Implemented in canonical SQL; live state unverified | All 32 tables enable RLS and revoke direct anon/authenticated access; service role only. Disposable PostgreSQL verifies browser grants. The configured live hostname does not resolve. |
| AUD-06 legacy webhook transport | Implemented | Weekly and Discord/custom deliveries use the shared safe transport with bounded resolution/connection/response size. Summary values come from exact, checked GitHub counts, not cumulative snapshots or fabricated zeroes. |
| AUD-07 DNS rebinding | Implemented | Resolve and validate all addresses, pin the checked address in socket lookup, preserve HTTPS hostname verification, reject embedded credentials/redirects and unsafe Host overrides. Separate IPv4/IPv6 block lists prevent cross-family matching bugs. `safe-webhook-fetch.test.ts`. |
| AUD-08 paid AI access | Implemented | Authenticated roast endpoint; bounded stream/body/languages/stats/mode; atomic per-user/global Redis quota, production fail-closed without Redis; provider deadline. AI quota and roast/input regressions. |
| AUD-09 environment validation | Implemented | Legitimate private credentials accepted; public secret names rejected; dotenv and injected variables checked consistently; encryption-key format validated. Node canaries cover private/public configuration. |
| AUD-10 secret scanner | Implemented | Cross-platform JS scanner covers JS/JSX/TS/TSX; shell wrapper delegates to it. Harmless extension canaries and server/client boundaries checked in CI. |
| AUD-11 incomplete setup schema | Implemented; deployment required | Full 32-table bootstrap, missing columns/indexes/functions, export query corrections and generated typed contracts. Fresh/repeated PostgreSQL bootstrap and literal query contract checks. |
| AUD-12 migration collisions | Implemented baseline; live history reconciliation required | Preserve all 56 historical migrations unchanged in legacy-migrations; one active complete baseline; safe conversions for known UUID/date/numeric variants; retain orphaned history with NOT VALID constraints. Disposable legacy upgrade preserves fixture rows. See adoption guide. |
| AUD-13 goal sync | Implemented | Canonical repo field and CRUD validation; checked exact totals for all six derived units, recurrence periods, owner-filtered writes, no partial-upstream writes; nonrecurring goals count from creation. Goal regressions and database selector checks. |
| AUD-14 cron contract | Implemented; scheduler deployment required | Dedicated strict cron-authenticated GET bulk goal endpoint, persisted encrypted tokens, atomic goal rollover and leased/cursor-based bounded work; user POST stays owner scoped. Vercel schedules match exported handlers; OpenAPI method gate. |
| AUD-15 PWA build | Implemented | Webpack build/dev selected for the configured PWA plugin; production build emits worker/custom cleanup worker and standalone static assets; generated worker strategies are checked rather than trusting configuration alone. |
| AUD-16 worker CSP | Implemented | worker-src self/blob plus fresh nonce-bearing scripts; production script policy omits unsafe-inline/eval. Root theme hydration uses the same nonce. CSP and browser checks. |
| AUD-17 private caches | Implemented | Personalized APIs and document navigations use NetworkOnly; offline navigation serves only the shared public fallback; no authenticated page/start URL runtime cache; no ContributionGraph IndexedDB persistence; clear in-memory data on identity/query changes; activation removes legacy private caches, background-sync DB and keyval-store. Workbox configuration uses the installed plugin's workboxOptions boundary; 102 MB of documentation demo GIFs and public exports are excluded from install precaching. Production offline browser canaries. |
| AUD-18 language window | Implemented | Requested days determines UTC search boundary and cache key. Language API window regressions. |
| AUD-19 streak disagreement | Implemented with explicit privacy boundary | Shared 365-day/timezone collection and freeze-aware calculation for dashboard, badge and public profile; incomplete histories cannot award milestones. Public endpoints count public activity; private dashboard totals can legitimately differ. Streak regressions. |
| AUD-20 metric completeness/latency | Implemented within documented GitHub limits | Shared cache/coalescing/cooldowns/deadlines; bounded pagination/completeness metadata; contributions/repos/PR breakdown display incomplete-data notices; requested contribution dates validated. Exhaustive list collection beyond GitHub Search's 1,000-result cap remains unavailable and is identified as partial. |
| AUD-21 AI false metrics | Implemented | Metric handlers run in-process; check HTTP success, required fields and completeness before AI generation or persistence; unavailable/partial upstream data never becomes plausible zeroes. Insight ownership/failure regressions. |
| AUD-22 trusted proxy | Implemented | Proxy uses shared trusted-IP policy; HTTP/HTTPS cookie names follow NEXTAUTH_URL; revoked tokens rejected; Next 16 proxy convention. Redis command encoding and bounded transport corrected against [Upstash REST semantics](https://upstash.com/docs/redis/features/restapi); proxy regressions. |
| AUD-23 room realtime/schema | Implemented | Message feed uses authenticated API polling, timestamp+UUID cursor with tie ordering, abort/no-overlap behavior, independent poll cursor and merge ordering. Required tables/columns now exist. |
| AUD-24 realtime identity bridge | Implemented | Removed anonymous browser Supabase subscriptions; authenticated polling honors existing NextAuth identity and server ownership checks. Supabase browser roles stay denied. |
| AUD-25 hidden database drift | Implemented | One typed service client; server-only compatibility re-export; missing config throws instead of pretending success; generated Row/Insert/Update/FK/RPC contracts plus source/schema selector gate. Export errors produce 503. Atomic account deletion verifies stable ownership, rolls back failures and expires all session-cookie chunks. |
| AUD-26 runtime/tooling | Implemented | Node 22.12 through 22.x and pnpm 11.13.1 aligned across manifest, lockfile, local docs, CI, Docker and Render; frozen install validated; security patches included before install. |
| AUD-27 deployment examples | Implemented configuration; execution pending | Production Compose added, standalone asset copy fails on missing output/copy errors, non-Vercel deployments do not request unavailable Vercel telemetry scripts, Docker public build arguments and runtime-only private credentials, Node/pnpm/patches corrected, Render encryption key format corrected, self-hosting/setup/adoption docs aligned. Docker daemon unavailable; no image build or hosted rollout performed. |
| AUD-28 verification gaps | Implemented baseline gates | CI includes Node and PostgreSQL suites, blocking coverage baseline, required test job, dependency/security/API gates and coverage artifact. Coverage remains modest; threshold preserves the baseline rather than pretending all features are covered. |
| AUD-29 automation failures | Implemented configuration; hosted runs pending | Guard bot accounts; pagination and permission-tolerant assignment handling; remove duplicate broken typecheck workflow; audited lockfile/overrides. GitHub workflow changes have not run on the server yet. |
| AUD-30 OpenAPI drift | Implemented route/method/security coverage; JSON schema expansion partial | Source-derived 109 paths/143 operations including route.tsx and corrected PATCH/badge/cron methods; cookie, cron, local coding, rebuild and webhook authorizers documented; CI verifies drift. Existing endpoint schemas corrected where changed. Newly inventoried generic operations explicitly mark endpoint-specific JSON schemas not yet expanded. |
| AUD-31 maintenance | Partial cleanup | Removed every file-wide @ts-nocheck, extracted StreakTracker hook and shared goal/streak/GitHub/AI/weekly services, fixed encoding and all existing lint warnings, typed the database. noImplicitAny remains disabled and some large UI modules still need incremental refactoring; broad cosmetic rewrites are deferred. |

## Validation and How to Test

Recorded full application checks on **2026-10-11**:

| Check | Result | Evidence |
|---|---|---|
| Vitest/V8 | 2,478 passed, 175 files; 31.91% line coverage | [unit JSON](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/vitest-verified.json) |
| Additional Node suites | 54 passed | [Node result/log](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/node-result.json) |
| Playwright against production standalone | 52 passed; zero skips/unexpected/flaky cases | [browser JSON](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/playwright-verified.json) |
| TypeScript/ESLint | Passed; zero lint errors/warnings | [TypeScript](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/typecheck-result.json), [lint](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/lint-result.json) |
| Production build/PWA | Passed with dummy credentials; standalone/worker/fallback generated and checked | [build](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/build-result.json), [worker](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/pwa-result.json) |
| PostgreSQL/contracts | 32-table RLS/grants; repeat/legacy upgrades; invitations/replay; rollover; deletion rollback/isolation; generated types; 487 literal query contracts | [database result](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/database-result.json), [query gate](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/database-contracts-result.json) |
| Dependency audit | Two exact-version advisories mitigated by verified patches; no unmitigated entries in the recorded run | [raw report](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/dependency-audit.json) |
| OpenAPI/imports/env scanner | Passed; 109 paths/143 operations | [API check](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/api-result.json) |
| Workflow/deployment YAML / whitespace | Parsed all 15 workflows and API/Compose/Render YAML; whitespace check clean | [whitespace result](https://github.com/Priyanshu-byte-coder/devtrack/blob/fix/audit-and-github-reliability/docs/repairs/evidence/diff-whitespace-check.json) |

The production browser regressions exercise the actual session endpoint, CSP hydration, legacy private-cache/IndexedDB cleanup, private-session offline denial and public offline navigation. Provider/database-dependent flows use dummy/mocked services; PostgreSQL tests are disposable. These results do not establish live OAuth grants, real deliveries, production RLS/history, hosting cron limits or runtime logs. Sentry/OpenTelemetry/next-intl build warnings and JSDOM Canvas limitations remain nonfatal and are recorded in logs.

Use **Node 22.12+ within major 22**, then:

```sh
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm install --frozen-lockfile
pnpm run lint
pnpm run type-check
pnpm run test:coverage -- --maxWorkers=4
pnpm run test:node
pnpm run test:db
pnpm run api:check
pnpm run security:env
pnpm run security:audit
node scripts/check-coverage.cjs
```

For the same isolated production build/browser checks that produced this evidence:

```sh
node docs/repairs/verify.cjs build
node docs/repairs/verify.cjs pwa
node docs/repairs/verify.cjs browser
node docs/repairs/verify.cjs browser-security
```

Install Playwright Chromium first when starting in a clean environment. `verify.cjs` writes UTF-8 logs and the real child exit status. Build/browser helpers override local dotenv key values with dummy provider/database credentials. Windows PowerShell uses `pnpm.cmd`/`npm.cmd`; if the globally installed pnpm's automatic version switch fails, use `npm.cmd exec --yes --package=pnpm@11.13.1 -- pnpm ...`. Preserve original audit evidence; earlier failing/intermediate repair reports are under `docs/repairs/evidence/iterations/` and must not be read as final failures. The dated summary's committed/pushed flags describe the original local verification snapshot.

## Claude continuation: remaining work and acceptance criteria

### 1. Complete AUD-30 endpoint-specific API schemas

- Locate operations marked `x-contract-detail` in `public/openapi.yaml` and inspect their real route handlers and response types.
- Expand request/query/body/success/error/partial-data/Retry-After schemas and examples. Do not document provider tokens in session output or infer anonymous authorization from GET alone.
- Keep `scripts/sync-openapi.cjs` authoritative for route/method/security drift; it preserves existing operation details. Run api:generate/api:check and YAML validation.
- **Acceptance:** remaining generic operations have accurate endpoint-specific contracts, 109 current paths/143 current methods stay source-aligned, and documented identity/rate/partial-data semantics agree with handlers. Counts can change only if Claude intentionally adds/removes routes.

### 2. Complete AUD-31 incremental typing and module cleanup

- Start with larger Settings/Landing/repo/CV modules identified by INVENTORY.md. Preserve behavior and split state/network/data transformation/presentation along actual responsibilities.
- noImplicitAny currently remains false. Address implicit-any debt in manageable slices before enabling a stricter compiler policy; retain zero file-wide @ts-nocheck directives.
- **Acceptance:** meaningful type/refactor improvements, no runtime/UI regressions, lint/type-check/build and relevant tests pass, and changes are explained in the ledger. Expand meaningful coverage beyond the 30% gate as areas are changed.

### 3. Resolve live database access and adopt the schema safely

- The configured Supabase hostname returned **ENOTFOUND** in a read-only metadata probe. No records/schema/grants were returned. Obtain the current project endpoint and credentials through private configuration, never PR comments/committed files.
- Snapshot the database and `supabase_migrations.schema_migrations`; restore to staging; inventory real columns/types/FKs/grants, duplicates and orphaned rows.
- Follow supabase/README.md. Apply the complete canonical SQL in one transaction to staging, preserving history; reconcile the actual remote migration history with the squashed baseline only after successful adoption. Do not blindly run db reset/db push or mark old migration versions reverted/applied.
- Map room_members.github_id, room_invitations.github_id and room_messages.sender_github_id from independently verified historical identities. Display names/recycled handles are insufficient; unmapped access fails closed and unknown message authors are preserved during deletion.
- Reconcile and validate NOT VALID orphan constraints from verified owners. Resolve rejected fractional/overflow counts, duplicate periods or incompatible core identities explicitly.
- **Acceptance:** snapshot-backed staging adoption preserves records, all 32 tables/functions/columns match, anonymous/cross-user access is denied, invitations/rooms/rollover/export/deletion work with real Supabase, and production adoption/history reconciliation is documented after staging succeeds.

### 4. Identify hosting project, configure secrets, deploy and verify real integrations

- Vercel CLI authenticated successfully, but the accessible team had **no DevTrack project**. Obtain the correct project/scope or actual hosting platform. No deployment/environment mutation occurred in this work.
- Configure server-only service-role/OAuth/provider secrets, stable **64-hex ENCRYPTION_KEY**, CRON_SECRET, and Upstash URL/token. Redis is required for production paid AI quotas. Do not rotate an existing encryption key without an explicit credential migration.
- Re-sign in after adoption so the primary GitHub token is stored encrypted for cron. Confirm private analytics' OAuth grants and public profiles' public-only activity boundary.
- Ensure the host supports configured cron frequency/maxDuration and that scheduled URLs use the new cron-authenticated GET contracts. Test leases/cursors, duplicate suppression and continuation on a user cohort exceeding one batch.
- Stage actual GitHub login/revocation, renamed/same-display-name room identities, memberships/invitations/polling, repository/date-scoped goal counts/rollovers, cooldown/Retry-After and partial-data UX, AI quota/provider errors, webhook/Discord test+retry+weekly delivery, export/deletion and real browser offline/CSP behavior.
- **Acceptance:** hosted CI is green on the final head; configuration/schema are adopted; real integration checks and runtime logs are reviewed; production rollout is documented. Keep this PR draft until these prerequisites are understood and remaining work is resolved.

### 5. Validate Docker execution

- The local Docker daemon was unavailable, so YAML/configuration was inspected but no image was built/run.
- Run production Compose using a reviewed private .env and correct public build arguments. Only public Supabase/app configuration goes into build args; private keys remain runtime env_file. Rebuild if public values change.
- **Acceptance:** production image builds with frozen pnpm/patches, standalone assets/worker exist, non-root container and health check work, and real runtime configuration reaches the intended Supabase/OAuth/provider services.

### Continuation checklist

- [ ] Read audit/context/inventory/repair ledger and current branch diff before changing code.
- [ ] Re-run hosted/local checks against the actual final head; distinguish dated evidence from new results.
- [ ] Complete remaining API response schemas.
- [ ] Complete scoped typing/large-module cleanup; retain regression coverage and no file-wide type suppression.
- [ ] Obtain the correct Supabase endpoint and hosting project privately.
- [ ] Snapshot, stage and verify schema/history/legacy-identity adoption.
- [ ] Verify Docker image execution with an available daemon.
- [ ] Configure stable encryption, cron, Redis and providers; verify real integrations in staging.
- [ ] Review hosted CI/security audit/coverage and production runtime logs.
- [ ] Update the repair ledger and PR description around the final implementation, then mark ready for review.

## Checklist and Review Notes

- [x] Audit findings, source context, inventories and point-in-time GitHub backlog documented.
- [x] Local implementation/regression evidence provided with dates, commands and limitations.
- [x] Known local lint/type/build/test/database/API/security gates passed in recorded validation.
- [x] Breaking schema/auth/cache/runtime changes and adoption procedure documented.
- [x] Historical migrations preserved; no production data was reset/deleted in this work.
- [x] Local credentials, generated build/test/cache outputs and pre-existing .scannerwork are excluded from publication; only reviewed audit/repair evidence is included.
- [ ] Hosted GitHub checks on this draft's exact head reviewed after upload.
- [ ] Live schema adoption, production deployment, Docker execution and remaining AUD-30/AUD-31 tasks completed.

No issues are auto-closed by this draft. Local fixes do not prove that every historical report is deployed or that every open contributor PR is safe to merge. Existing repo tests cover part of the application (31.91% line coverage); the new 30% CI baseline is a regression floor. Accessibility/mobile/visual coverage beyond the existing tests needs review if Claude makes further UI changes.

Publication note: the automatic lint-staged formatter is bypassed for this packaging commit to preserve raw baseline audit evidence and reviewed patch bytes. The prior full lint/type/build/test validation and fresh publication database/API/import/environment/dependency checks are recorded above. Re-run normal contributor checks after continuation edits.
