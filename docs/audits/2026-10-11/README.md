# DevTrack audit — 2026-10-11

This documents current context and defects for a later repair phase. No application source, dependency versions, workflows, database, or GitHub settings were intentionally changed. New deliverables are under this directory; build/test outputs remain local.

## Repository baseline

- Repository: [Priyanshu-byte-coder/devtrack](https://github.com/Priyanshu-byte-coder/devtrack). GitHub CLI authenticated account: Priyanshu-byte-coder.
- Fetched all remote branches and tags. Fast-forward pull of origin/main returned **Already up to date**.
- Audited main SHA: `a20e51d437a220db4e626a072a9716b67381eca9`, dated 2026-09-12. Later remote activity is on other branches.
- Pre-existing untracked `.scannerwork/` preserved. No reset, checkout, merge, commit, push, issue closure, or PR mutation.
- Inventory: **777 tracked files, 411 source files, 71,536 source lines, 152 component TSX files, 24 page TSX files, 108 API route files, 56 migrations**.
- GitHub snapshot: **124 open issues, 23 open PRs**. Counts are point-in-time.

## Documents

- [CONTEXT.md](CONTEXT.md): architecture, identity/data flow, integrations, directories, and runtime matrix.
- [INVENTORY.md](INVENTORY.md): every API handler, tables, migration collisions, environment names, large modules, and spec drift.
- [GITHUB_BACKLOG.md](GITHUB_BACKLOG.md): every open issue/PR, failed checks, and provisional triage.
- [DEPENDENCIES.md](DEPENDENCIES.md): all production dependency advisory entries.
- [evidence/](evidence/): machine reports, GitHub snapshots, and harmless reproduction helpers.

## Verification

| Check | Result | Evidence and limits |
|---|---|---|
| TypeScript | PASS, exit 0 | [typecheck](evidence/typecheck.txt) |
| ESLint src | 0 errors, 4 warnings, 411 files | [lint JSON](evidence/eslint.json) |
| Dependency import checker | PASS | [imports](evidence/dependency-import-check.txt); checks imports, not vulnerabilities |
| Vitest | 163 files, 2,387 tests passed | [JSON](evidence/vitest.json); 655 reported suites include nested describe groups |
| Five omitted Node test files | 45 additional tests passed | [Node tests](evidence/node-tests.txt) |
| Production build | PASS with dummy credentials / CI=true | [build](evidence/build-network-enabled.txt); initial font-download sandbox failure resolved on retry |
| Non-CI environment validator | FAILS with legitimate dummy server-secret names | [reproduction](evidence/env-validator-repro.txt) |
| Service-key scanner | Misses a harmless .ts canary | [reproduction](evidence/env-scanner-repro.txt) |
| Production dependency audit | 35 advisory entries / 29 unique GHSA IDs | [JSON](evidence/dependency-audit-network-enabled.json); 1 critical, 17 high, 14 moderate, 3 low |
| OpenAPI YAML | Parses; no duplicate mapping keys | [comparison](evidence/api-spec-inventory.json); significant contract drift |
| Source merge-conflict markers | None found | [inventory](evidence/inventory.json) |
| Safe mock reproductions | Confirmed browser session token, anonymous weekly/AI calls, bulk POST behavior | [results](evidence/safe-reproductions.json); no network |
| Exact-main GitHub CI/unit workflow | SUCCESS | [CI](https://github.com/Priyanshu-byte-coder/devtrack/actions/runs/34690483286), [unit workflow](https://github.com/Priyanshu-byte-coder/devtrack/actions/runs/34690483290) |
| Main line coverage | 30.56%, nonblocking | [coverage log](evidence/github-main-coverage.txt); upload also reports Repository not found |
| Main deployment | GitHub Vercel status: completed | [status](evidence/github-head-status.json); runtime logs were not inspected |
| Playwright | PASS, 49/49, no skips/flakes | [final result](evidence/e2e-summary.json); 49 discovered cases |

The project is compiling and its main unit suite is green. These checks do not establish correct authorization, database migration compatibility, cron wiring, or offline behavior.

## Finding index

| ID | Priority | Finding |
|---|---|---|
| [AUD-01](#aud-01) | P0 | Weekly notifications lack authentication and disclose webhook URLs |
| [AUD-02](#aud-02) | P0 | Room membership is authorized using mutable display names |
| [AUD-03](#aud-03) | P1 | Broad GitHub OAuth token is exposed in the browser session |
| [AUD-04](#aud-04) | P1 | Current production dependencies have new advisories |
| [AUD-05](#aud-05) | P1 | Committed SQL does not enable RLS on several user-owned tables |
| [AUD-06](#aud-06) | P1 | Legacy weekly delivery bypasses SSRF protection |
| [AUD-07](#aud-07) | P1 | Custom webhook DNS validation is separate from connection resolution |
| [AUD-08](#aud-08) | P1 | Anonymous callers can invoke paid Gemini roast/hype generation |
| [AUD-09](#aud-09) | P1 | Environment validation rejects legitimate private credentials |
| [AUD-10](#aud-10) | P1 | CI service-key scanner misses ordinary JS/TS files |
| [AUD-11](#aud-11) | P1 | Documented schema-only setup omits current tables and columns |
| [AUD-12](#aud-12) | P1 | Migration collisions and incompatible foreign-key types prevent reliable replay |
| [AUD-13](#aud-13) | P1 | Goal sync queries repository columns absent from committed goal DDL |
| [AUD-14](#aud-14) | P1 | Goal-sync cron cannot invoke the scheduled route contract |
| [AUD-15](#aud-15) | P1 | Successful default build does not generate the PWA worker |
| [AUD-16](#aud-16) | P1 | Worker CSP excludes the application's own worker |
| [AUD-17](#aud-17) | P1 | Personalized API caches have no user boundary |
| [AUD-18](#aud-18) | P1 | Language metrics query the wrong time window |
| [AUD-19](#aud-19) | P2 | Public badge and dashboard disagree about streaks |
| [AUD-20](#aud-20) | P1 | GitHub metric collection has latency and completeness limits |
| [AUD-21](#aud-21) | P2 | AI insights turn upstream failures into plausible zero metrics |
| [AUD-22](#aud-22) | P1 | Middleware IP parsing bypasses the trusted-proxy policy |
| [AUD-23](#aud-23) | P2 | Room realtime wiring disagrees with the schema |
| [AUD-24](#aud-24) | P2 | Realtime subscriptions assume an identity bridge that is absent |
| [AUD-25](#aud-25) | P2 | Database types and client initialization conceal schema drift |
| [AUD-26](#aud-26) | P2 | Runtime and package-manager contracts diverge |
| [AUD-27](#aud-27) | P2 | Deployment examples do not satisfy the application contract |
| [AUD-28](#aud-28) | P2 | Green checks leave measurable verification gaps |
| [AUD-29](#aud-29) | P2 | Contributor and dependency automation fail independently of app tests |
| [AUD-30](#aud-30) | P2 | OpenAPI has substantial route/method drift |
| [AUD-31](#aud-31) | P3 | Large modules, weak typing, and encoding damage impede maintenance |

## Findings and repair priorities

**P0**: urgent authorization/exposure. **P1**: security or core functionality. **P2**: reliability/contracts/maintenance. **P3**: cleanup. “Source-confirmed” establishes the code path, not a live exploit. “Reproduced” below means harmless mocked/dummy inputs unless stated otherwise.

<a id="aud-01"></a>

### AUD-01 · P0 · Weekly notifications lack authentication and disclose webhook URLs

**Reproduced with mocks.** `src/app/api/notifications/weekly/route.ts:35` uses the service-role client to select all configured users, sends webhooks, and returns user IDs, logins, webhook URLs, and summaries. No session or cron guard exists; middleware allows API GETs through. The mock sent to two users without authentication. POST with one userId still calls the unfiltered GET and sends to both users.

Source anchors: [src/app/api/notifications/weekly/route.ts:35](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/notifications/weekly/route.ts#L35).

Later acceptance: unauthorized requests fail; bulk dispatch requires cron auth; manual dispatch is owner-scoped; single-user dispatch targets one user; URLs/provider responses are redacted.

<a id="aud-02"></a>

### AUD-02 · P0 · Room membership is authorized using mutable display names

**Source-confirmed.** Most `src/app/api/rooms/**` and invitation handlers pass `session.user.name` to membership queries in `src/lib/supabase-rooms.ts`. The installed NextAuth GitHub provider maps this to `profile.name`, falling back to login. Display names are neither unique nor stable: two GitHub accounts with the same display name query the same membership identifier. Changing a display name to an existing membership value creates a potential cross-user access path. The member-removal route instead uses githubLogin, causing inconsistent behavior even without an attacker.

Source anchors: [src/app/api/rooms/[roomId]/route.ts:15](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/rooms/[roomId]/route.ts#L15), [src/lib/supabase-rooms.ts:18](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/supabase-rooms.ts#L18), [src/app/api/rooms/[roomId]/members/[username]/route.ts:15](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/rooms/[roomId]/members/[username]/route.ts#L15).

Later acceptance: persist stable app/GitHub IDs for all room ownership/membership; resolve invitation handles explicitly; different account IDs with the same display name stay isolated. Review existing membership data before migration. No live room was accessed.

<a id="aud-03"></a>

### AUD-03 · P1 · Broad GitHub OAuth token is exposed in the browser session

**Reproduced with a dummy token.** `src/lib/auth.ts:179` copies the JWT accessToken into the browser-accessible session. Requested scope includes `repo` plus user, discussion, and organization access. An encrypted HttpOnly JWT cookie does not prevent JavaScript reading the session endpoint. CSP additionally permits unsafe-inline/unsafe-eval, increasing the impact of any browser-script compromise. This is token exposure, not proof of an active XSS exploit.

Source anchors: [src/lib/auth.ts:179](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/auth.ts#L179), [next.config.mjs:191](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/next.config.mjs#L191).

Later acceptance: no provider credentials in client session JSON; server-only token retrieval; migrate all server session.accessToken consumers together; reconsider requested scopes. Related: [#856](https://github.com/Priyanshu-byte-coder/devtrack/issues/856), [#2299](https://github.com/Priyanshu-byte-coder/devtrack/issues/2299), [PR #2875](https://github.com/Priyanshu-byte-coder/devtrack/pull/2875).

<a id="aud-04"></a>

### AUD-04 · P1 · Current production dependencies have new advisories

**Registry audit confirmed; individual exploitability unproven.** There are 35 entries, including one critical Next.js advisory. Next 16.3.5 is affected by [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), patched in 16.3.6; additional Next advisories require 16.3.8. The critical issue applies to Node ImageResponse with attacker-controlled SVG content/attributes/styles. Two DevTrack OG API routes use Edge, outside this advisory; the profile image route uses Node, but a vulnerable SVG-input path was not proven. Do not equate the package classification with a reproduced RCE.

Other affected chains include axios, sharp, brace-expansion, braces, DOMPurify, source-map-js, fast-uri, and sprintf-js. [DEPENDENCIES.md](DEPENDENCIES.md) contains every entry. Existing dependency PRs #3523/#3522/#3521/#3519/#3518 need review; a 38-package bump is not automatically safe to merge.

Source anchors: [package.json:45](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/package.json#L45), [src/app/u/[username]/opengraph-image.tsx:9](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/u/[username]/opengraph-image.tsx#L9).

Later acceptance: deliberate compatible updates, frozen install, build/tests, fresh audit, and reachability review.

<a id="aud-05"></a>

### AUD-05 · P1 · Committed SQL does not enable RLS on several user-owned tables

**Source-confirmed; live grants/policies unverified.** Across schema.sql and migrations, no enable statement was found for ai_insights, data_export_audit, devtrack_badges, jira_credentials, leaderboard_cache, local_coding_api_keys, local_coding_sessions, milestones, notifications, or streak_milestones. The schema-only setup additionally lacks enablement for daily_notes, metric_snapshots, and user_github_accounts. Some hold credentials or private activity. Actual exposure depends on live grants/manual changes; none was queried.

Source anchors: [supabase/schema.sql:1](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/supabase/schema.sql#L1), [supabase/migrations/20260610000000_add_milestones.sql:3](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/supabase/migrations/20260610000000_add_milestones.sql#L3).

Later acceptance: inspect real migration history/grants, define narrow policies, and test anonymous/cross-user isolation on a disposable database. Passing service-role route mocks cannot validate RLS.

<a id="aud-06"></a>

### AUD-06 · P1 · Legacy weekly delivery bypasses SSRF protection

**Source-confirmed.** `src/app/api/user/settings/route.ts:260` accepts any string webhook_url. The weekly sender performs raw fetch with default redirects and no address validation or timeout. An authenticated user can configure an internal URL; AUD-01 adds a public trigger. No internal address was contacted in this audit.

Source anchors: [src/app/api/user/settings/route.ts:260](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/user/settings/route.ts#L260), [src/app/api/notifications/weekly/route.ts:16](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/notifications/weekly/route.ts#L16).

Later acceptance: shared safe outbound transport, validated/pinned destinations, redirect limits, and deadlines for legacy and custom delivery.

<a id="aud-07"></a>

### AUD-07 · P1 · Custom webhook DNS validation is separate from connection resolution

**Source-confirmed.** `src/lib/ssrf-protection.ts` resolves/checks addresses; dispatch/test/retry then call fetch, which resolves again. DNS rebinding can invalidate the first check. Current main already blocks 0.0.0.0/8, so the zero-network portion of [#2668](https://github.com/Priyanshu-byte-coder/devtrack/issues/2668) is stale. The rebinding concern in [#2564](https://github.com/Priyanshu-byte-coder/devtrack/issues/2564) remains. dispatchWebhook uses manual redirects, so automatic redirect-following should not be attributed to that specific function.

Source anchors: [src/lib/ssrf-protection.ts:81](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/ssrf-protection.ts#L81), [src/lib/webhooks.ts:70](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/webhooks.ts#L70).

Later acceptance: pin the checked address through transport while preserving HTTPS verification; cover private/reserved addresses and every outbound delivery caller. PR #2669 conflicts and requires review.

<a id="aud-08"></a>

### AUD-08 · P1 · Anonymous callers can invoke paid Gemini roast/hype generation

**Reproduced with a mocked provider.** `src/app/api/ai/roast/route.ts:7` accepts mode/stats, calls Gemini, and returns a result without session auth, payload bounds, or a quota. Middleware limits metrics/contact/auth, not this path. A headerless dummy request invoked the model and returned 200.

Source anchors: [src/app/api/ai/roast/route.ts:7](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/ai/roast/route.ts#L7).

Later acceptance: authenticate, bound inputs, use durable per-user/global quotas, and fail clearly when provider configuration is missing. Actual provider credentials/costs were not used.

<a id="aud-09"></a>

### AUD-09 · P1 · Environment validation rejects legitimate private credentials

**Reproduced.** `scripts/validate-env.js` errors on non-NEXT_PUBLIC names containing secret/token/password/api_key. Dummy NEXTAUTH_SECRET/GITHUB_SECRET alone produce exit 1. Sensitive public-prefixed names are excluded from the error, reversing the intended boundary. It runs before Next loads dotenv, so dotenv-only values may also escape checks. CI/GITHUB_ACTIONS skip it entirely.

Source anchors: [scripts/validate-env.js:29](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/scripts/validate-env.js#L29).

Later acceptance: validate required formats and forbid public secrets, with consistent dotenv/injected-variable handling. Server credentials must pass; public secret canaries must fail.

<a id="aud-10"></a>

### AUD-10 · P1 · CI service-key scanner misses ordinary JS/TS files

**Reproduced with a variable-name-only canary.** `scripts/check-env-security.sh:6` passes the quoted include glob `*.{js,jsx,ts,tsx}` to grep. Grep does not expand shell braces. A canary.ts containing only NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY was missed, producing grep exit 1 and a false “clean” result.

Source anchors: [scripts/check-env-security.sh:6](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/scripts/check-env-security.sh#L6).

Later acceptance: detect canaries in each extension, exclude dependency/output folders, and retain actual import-boundary/secret-scanning checks. No real secret entered the fixture.

<a id="aud-11"></a>

### AUD-11 · P1 · Documented schema-only setup omits current tables and columns

**Source-confirmed.** DEVELOPMENT.md and self-hosting docs instruct users to run schema.sql. That file omits ten queried tables: cv_analyses, cv_generated_content, daily_focus, data_export_audit, devtrack_badges, milestones, streak_milestones, user_github_orgs, webhook_configs, webhook_deliveries. Missing columns include users.email, weekly_digest_opt_in, last_digest_sent_at, preferred_locale, seen_onboarding, discord_muted_until, public_widgets, and goals.is_public/goal_reset_version.

Source anchors: [DEVELOPMENT.md:38](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/DEVELOPMENT.md#L38), [supabase/schema.sql:1](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/supabase/schema.sql#L1).

Later acceptance: one tested bootstrap/upgrade process produces the full required schema. Missing schema is a candidate explanation for historical goal/settings errors, not a proven cause of issue #979.

<a id="aud-12"></a>

### AUD-12 · P1 · Migration collisions and incompatible foreign-key types prevent reliable replay

**Source-confirmed.** Ten migration version prefixes collide; 20260603000001 appears three times. cv_intelligence.sql lacks a timestamp. Legacy 20250607_goal_history.sql uses UUID references to text users.id/goals.id. The milestones migration likewise declares user_id UUID referencing text users.id. These FKs cannot be created against the canonical schema as written. Feature migrations are not a complete baseline.

Source anchors: [supabase/migrations/20260610000000_add_milestones.sql:3](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/supabase/migrations/20260610000000_add_milestones.sql#L3), [supabase/migrations/20250607_goal_history.sql:3](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/supabase/migrations/20250607_goal_history.sql#L3).

Later acceptance: inspect deployed history before renaming anything; build valid baseline/forward repairs; test reset and upgrades on disposable data. See [Supabase migration guidance](https://supabase.com/docs/guides/local-development/database-migrations). No database migration was executed.

<a id="aud-13"></a>

### AUD-13 · P1 · Goal sync queries repository columns absent from committed goal DDL

**Source-confirmed.** `src/app/api/goals/sync/route.ts:60` selects id, unit, repo, repository, repo_name. None of the three repository fields exists on goals in schema.sql or the migrations. A repository-derived installation fails that PostgREST query before filter validation and returns Failed to fetch goals (500). Mock query builders accept arbitrary columns and hide this defect.

Source anchors: [src/app/api/goals/sync/route.ts:60](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/goals/sync/route.ts#L60).

Later acceptance: one canonical repository field and migration, aligned CRUD/sync contracts, and a real schema-backed query check.

<a id="aud-14"></a>

### AUD-14 · P1 · Goal-sync cron cannot invoke the scheduled route contract

**Source-confirmed.** vercel.json schedules /api/goals/sync; its only handler is POST and requires a user session. [Vercel cron](https://vercel.com/docs/cron-jobs) invokes GET with its cron credential. This schedule therefore cannot run the current handler. /api/cron/sync is also POST-only, is not scheduled, and retains a development auth bypass rather than the shared guard.

Source anchors: [vercel.json:12](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/vercel.json#L12), [src/app/api/goals/sync/route.ts:37](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/goals/sync/route.ts#L37), [src/app/api/cron/sync/route.ts:9](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/cron/sync/route.ts#L9).

Later acceptance: separate cron-authenticated GET bulk jobs from user POST sync, with persisted tokens, method/auth tests, and bounded work.

<a id="aud-15"></a>

### AUD-15 · P1 · Successful default build does not generate the PWA worker

**Build artifact confirmed.** The network-enabled build succeeds using Turbopack, but public/sw.js and standalone/public/sw.js are absent afterward. The installed next-pwa integration uses webpack hooks/plugins; [Turbopack does not support webpack plugins](https://nextjs.org/docs/app/api-reference/turbopack). OfflineBanner still registers /sw.js.

Source anchors: [next.config.mjs:1](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/next.config.mjs#L1), [package.json:8](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/package.json#L8), [src/components/OfflineBanner.tsx:12](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/components/OfflineBanner.tsx#L12).

Later acceptance: choose a supported integration; a clean build produces a fresh worker and production browser tests cover its MIME type, offline behavior, and upgrade lifecycle. Build success alone does not establish PWA functionality.

<a id="aud-16"></a>

### AUD-16 · P1 · Worker CSP excludes the application's own worker

**Source-confirmed configuration mismatch.** next.config.mjs sets worker-src blob: without 'self', while OfflineBanner registers /sw.js. An explicit [worker-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src) controls worker origins; same-origin registration is excluded by this value. This becomes a second obstacle once AUD-15 is repaired; browser registration was not independently reproduced against a generated worker.

Source anchors: [next.config.mjs:200](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/next.config.mjs#L200), [src/components/OfflineBanner.tsx:12](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/components/OfflineBanner.tsx#L12).

Later acceptance: permit the required worker origin and verify registration under the actual response CSP.

<a id="aud-17"></a>

### AUD-17 · P1 · Personalized API caches have no user boundary

**Conditional source risk.** The PWA runtime-caching configuration uses static cache names and URL matching for personalized APIs. Signing out does not clear those caches or give the next user a new namespace. With a functioning worker, a shared-browser account switch could reuse prior-user responses. AUD-15 currently prevents the tested build from producing that worker; no live cache disclosure was reproduced.

Source anchors: [next.config.mjs:40](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/next.config.mjs#L40).

Later acceptance: exclude authenticated APIs from persistent browser caching or implement tested per-user partitioning and logout eviction.

<a id="aud-18"></a>

### AUD-18 · P1 · Language metrics query the wrong time window

**Source-confirmed.** src/app/api/metrics/languages/route.ts creates since as the current date, parses days, but never subtracts days. The GitHub query therefore starts today, rather than the requested period. The surrounding cache key also omits days, so differing periods share a result.

Source anchors: [src/app/api/metrics/languages/route.ts:58](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/metrics/languages/route.ts#L58).

Later acceptance: correctly derive the requested interval, include it in cache keys, and test distinct windows with controlled GitHub fixtures.

<a id="aud-19"></a>

### AUD-19 · P2 · Public badge and dashboard disagree about streaks

**Source-confirmed; open issue #3027 corroborates the symptom.** The streak badge uses UTC, a 90-day window, at most 100 commits, and no freeze semantics. Dashboard calculations use the stored timezone, a longer window with pagination, and freezes. One user can therefore have different streak values across surfaces. The older report that all dashboard calculations ignore timezone is only partially current.

Source anchors: [src/app/api/badge/streak-shield/route.ts:44](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/badge/streak-shield/route.ts#L44), [src/app/api/metrics/streak/route.ts:91](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/metrics/streak/route.ts#L91), [src/lib/streak.ts:16](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/streak.ts#L16).

Later acceptance: share an explicit streak contract, covering midnight boundaries, pagination, and freezes, across the badge, profile, and dashboard.

<a id="aud-20"></a>

### AUD-20 · P1 · GitHub metric collection has latency and completeness limits

**Source-confirmed; production timeout not reproduced.** Contributions may issue up to ten sequential requests without an overall deadline and still cap commit history at 1,000. The repos route ranks repositories using a single page of the latest 100 matching commits, then returns the top six. That can bias rankings even within the requested period. PR breakdowns likewise do not represent unlimited account history. The PR breakdown has a single 100-item page. Issue #135's original 100-commit limit was improved by pagination, while #3170's sequential-request concern remains.

Source anchors: [src/app/api/metrics/contributions/route.ts:164](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/metrics/contributions/route.ts#L164), [src/app/api/metrics/repos/route.ts:161](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/metrics/repos/route.ts#L161), [src/app/api/metrics/prs/route.ts:116](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/metrics/prs/route.ts#L116).

Later acceptance: define completeness and supported periods, use bounded concurrency and end-to-end deadlines, and expose truncation instead of presenting a partial total as complete. Benchmark representative large accounts before changing hosting limits.

<a id="aud-21"></a>

### AUD-21 · P2 · AI insights turn upstream failures into plausible zero metrics

**Source-confirmed.** src/app/api/ai-insights/route.ts fetches four metric endpoints over HTTP on the same application. Failed calls are reduced to empty objects, normalized into zero-valued data, and can enter the 24-hour insights cache. This adds HTTP/session dependencies and can make an upstream failure look like a quiet activity period. The deadlock alleged in issue #2585 was not reproduced and is not asserted here.

Source anchors: [src/app/api/ai-insights/route.ts:70](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/api/ai-insights/route.ts#L70).

Later acceptance: use shared server-side metric functions, distinguish missing data from zero, and avoid caching a failed collection as a successful insight.

<a id="aud-22"></a>

### AUD-22 · P1 · Middleware IP parsing bypasses the trusted-proxy policy

**Source-confirmed; deployment-dependent.** src/middleware.ts has its own IP extractor that trusts cf-connecting-ip, then x-forwarded-for. src/lib/rate-limit.ts contains a separate trusted-proxy policy. Rate limits using the middleware path can be spoofable if the hosting proxy preserves client-supplied headers. The deployed ingress behavior was not inspected.

Source anchors: [src/middleware.ts:77](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/middleware.ts#L77), [src/lib/rate-limit.ts:9](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/rate-limit.ts#L9).

Later acceptance: use one ingress-aware extractor and test untrusted and proxy-set headers under the actual hosting contract.

<a id="aud-23"></a>

### AUD-23 · P2 · Room realtime wiring disagrees with the schema

**Source-confirmed.** MessageFeed subscribes to messages, while migrations and message APIs use room_messages. A RoomClient comment promises polling fallback, but MessageFeed does not implement it. The unavailable supabaseBrowser stub supports from(), but not channel(); unguarded channel() calls can fail when realtime configuration is absent.

Source anchors: [src/components/rooms/MessageFeed.tsx:36](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/components/rooms/MessageFeed.tsx#L36), [src/lib/supabase-browser.ts:30](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/supabase-browser.ts#L30).

Later acceptance: align table/filter names, add a working fallback, and render a usable room when realtime is disabled or disconnects.

<a id="aud-24"></a>

### AUD-24 · P2 · Realtime subscriptions assume an identity bridge that is absent

**Source-confirmed integration gap.** useRealtimeSync uses a Supabase anonymous browser client. Authentication is supplied by NextAuth; no corresponding Supabase JWT identity bridge was found. Policies depending on auth.uid() therefore do not inherit the GitHub/NextAuth user identity. Some users/streak subscriptions are not row-filtered. The hook stops polling on SUBSCRIBED, which establishes channel connection, not permission to receive the expected row events.

Source anchors: [src/hooks/useRealtimeSync.ts:131](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/hooks/useRealtimeSync.ts#L131), [supabase/schema.sql:45](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/supabase/schema.sql#L45).

Later acceptance: implement and document the realtime identity contract, restrict row scope, and retain fallback until actual expected events/authorization are established. Live RLS and publication settings were not queried.

<a id="aud-25"></a>

### AUD-25 · P2 · Database types and client initialization conceal schema drift

**Source-confirmed.** The generated database type only describes a minimal users row, while the application reads many other columns/tables. Broad any casts weaken compile-time checking. There are multiple service-role client definitions and an unavailable-client stub that is truthy: checks such as !supabaseAdmin do not detect missing configuration, leaving later operations to fail/catch instead.

Source anchors: [src/types/supabase.ts:16](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/types/supabase.ts#L16), [src/lib/supabase-admin.ts:40](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/supabase-admin.ts#L40), [src/lib/supabase.ts:18](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/lib/supabase.ts#L18).

Later acceptance: generate types from the canonical migrated schema, consolidate explicit client availability handling, and make startup/readiness failures observable.

<a id="aud-26"></a>

### AUD-26 · P2 · Runtime and package-manager contracts diverge

**Source-confirmed.** package.json/.nvmrc/Docker target Node 20; CI uses Node 22 and pnpm 11.12; the local audit used Node 22.14 and pnpm 11.9. The repo lacks a packageManager pin. Docker installs dependencies before copying pnpm-workspace.yaml, where overrides/build permissions live. Consequently a frozen lockfile alone does not establish identical install behavior. The [pnpm Node compatibility table](https://pnpm.io/installation) excludes Node 20 for pnpm 11. A Docker image build was not performed.

Source anchors: [Dockerfile:9](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/Dockerfile#L9), [pnpm-workspace.yaml:5](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/pnpm-workspace.yaml#L5), [.github/workflows/ci.yml:27](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/.github/workflows/ci.yml#L27).

Later acceptance: pin a supported Node/package-manager pair and include all install configuration before dependency installation in every environment.

<a id="aud-27"></a>

### AUD-27 · P2 · Deployment examples do not satisfy the application contract

**Source-confirmed.** Render uses npm rather than the pnpm lockfile/workspace configuration. Its generated ENCRYPTION_KEY does not explicitly guarantee the application's 64-hex-character format; cron credentials are absent. The self-hosting guide describes Compose as production-ready, but the checked-in Compose file selects the development target/server and omits CRON_SECRET; the separate Docker development guide correctly calls it a development setup. These examples can yield materially different installs or disabled jobs.

Source anchors: [render.yaml:5](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/render.yaml#L5), [docker-compose.yml:8](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/docker-compose.yml#L8), [docs/self-hosting.md:61](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/docs/self-hosting.md#L61).

Later acceptance: smoke-test documented deployment targets with their actual manifest, valid secret formats, production startup, and authenticated schedules. No external deployment was changed.

<a id="aud-28"></a>

### AUD-28 · P2 · Green checks leave measurable verification gaps

**Measured.** Vitest excludes five standalone Node test files; running them separately produced 45 additional passes. Main coverage is 30.56% lines, below the configured soft 60% threshold. Coverage uses continue-on-error and is outside ci-pass dependencies; a separate required unit-test workflow does run the suite. The workflow's dependency audit checks import existence rather than vulnerability advisories. Codecov reports Repository not found without failing the job. These are coverage/gating gaps, not a claim that all tests are ineffective.

Source anchors: [vitest.config.ts:10](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/vitest.config.ts#L10), [.github/workflows/ci.yml:79](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/.github/workflows/ci.yml#L79), [scripts/check-deps.js:1](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/scripts/check-deps.js#L1).

Later acceptance: explicitly run both test families, make important contract checks required, fix or remove the broken coverage uploader, and define achievable coverage/security gates.

<a id="aud-29"></a>

### AUD-29 · P2 · Contributor and dependency automation fail independently of app tests

**GitHub-log confirmed.** Auto-apply type labels attempts to assign Dependabot PR authors and receives HTTP 403 on /issues/3523/assignees. Five current dependency PRs fail this workflow while their app CI/E2E checks pass. The Dependabot updater also reports dependency_file_not_resolvable for conflicting brace-expansion override/version requirements. Some human PRs fail a deliberate star-required contribution policy, which should be distinguished from an application regression.

Source anchors: [.github/workflows/gssoc-labels.yml:97](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/.github/workflows/gssoc-labels.yml#L97), [.github/dependabot.yml:3](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/.github/dependabot.yml#L3), [pnpm-workspace.yaml:25](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/pnpm-workspace.yaml#L25).

Later acceptance: handle bot authors and permissions safely, reconcile multi-major overrides, and review contribution policy separately from engineering checks. See the full PR index and saved failure logs.

<a id="aud-30"></a>

### AUD-30 · P2 · OpenAPI has substantial route/method drift

**Measured from source and YAML.** There are 108 API route files versus 35 OpenAPI paths; 74 source paths are undocumented, and seven documented operations do not match current handlers. Examples include PUT versus PATCH for goals/settings, POST versus GET for leaderboard refresh/WakaTime sync, and a stale streak-badge path. No duplicate YAML mapping keys were found. This inventory is a method/path comparison, not proof that documented request/response schemas are otherwise correct.

Source anchors: [public/openapi.yaml:56](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/public/openapi.yaml#L56).

Later acceptance: validate an authoritative spec against route methods and representative request/response contracts in CI.

<a id="aud-31"></a>

### AUD-31 · P3 · Large modules, weak typing, and encoding damage impede maintenance

**Measured/source-confirmed.** settings/page.tsx is 1,961 lines; LandingPage 1,436; StreakTracker 1,172; GoalTracker 1,109. Several other files exceed 700 lines. noImplicitAny is disabled, and any casts hide data-shape problems. Genuine mojibake exists in tracked github-app.ts comments. Current TSX samples checked for the reported greeting/session issue contain valid Unicode; the historical UI symptom was not reproduced. Terminal decoding can also make valid source appear damaged. Lint currently reports four navigation warnings, no errors.

Source anchors: [src/app/dashboard/settings/page.tsx:1](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/src/app/dashboard/settings/page.tsx#L1), [tsconfig.json:15](https://github.com/Priyanshu-byte-coder/devtrack/blob/a20e51d437a220db4e626a072a9716b67381eca9/tsconfig.json#L15).

Later acceptance: split by behavior after contract repairs, preserve behavior with focused checks, correct actual UTF-8 text, and tighten typing incrementally. Avoid a broad cosmetic rewrite while authorization/data contracts remain unsettled.

## Browser result

The final production-mode Playwright run passed **49/49 tests**, with zero skips, unexpected failures, or flaky results, in about 158 seconds. It used isolated dummy provider/database credentials, two workers, no retries, and a 30-second per-test timeout. The helper aligned the test-fixture cookie secret with the web-server secret. An earlier harness mismatch produced authentication failures; those were corrected and are not recorded as application defects. An initial sandbox run stalled and was stopped without a test result.

This is the existing E2E suite with its fixtures, not verification of live GitHub/Supabase integrations or the PWA issues above. The separate visual-baseline suite was not run. See [final JSON](evidence/e2e.json) and [summary](evidence/e2e-summary.json).

## Suggested later repair sequence

1. Close authorization/token exposure paths: AUD-01/02/03/08; enforce safe outbound destinations and IP handling (06/07/22).
2. Patch and re-audit dependencies (04), then repair environment validation/scanning (09/10).
3. Establish one database bootstrap/migration/identity contract (05/11/12/13/24/25). Verify a clean database and a representative upgrade before touching live data.
4. Repair jobs and metric correctness (14/18/19/20/21), then realtime (23).
5. Restore and test the production PWA, with account-safe caching (15/16/17).
6. Align deployment/runtime/spec/test contracts and unblock automation (26/27/28/29/30).
7. Refactor oversized components and text/typing debt (31) once behavior is stable.

## Boundaries and unresolved evidence

This snapshot covers current main, the tracked source/configuration, all open GitHub issue/PR metadata, recent runs, saved available failure logs, local build/tests, and safe reproductions. It does not claim to execute every feature or prove every historical issue. Live database grants/RLS/publications, production request logs, actual cron executions, DNS/hosting behavior, real AI charges, and external-provider integrations were not queried. Old logs for PRs #2875/#2323 returned HTTP 410; their check failures are known, their exact historical root causes are not. Main-source findings must not be assumed fixed by an unmerged PR.

The original .scannerwork/ directory was preserved and its previous provenance was not established. No report infers a fresh scanner result from that directory. Fetching remote branches did not merge their code into main. All recommendations are for the later fix phase requested by the user.

