# Audit evidence and reproduction notes

The parent documents refer to these files. All checks used the audited main source; application code was not repaired. GitHub files are point-in-time public metadata/log snapshots. Local credentials were not copied into evidence.

## Final results

| Artifact | Meaning |
|---|---|
| baseline.json | Repository/branch/commit/runtime snapshot and tracked-change check |
| inventory.json | Tracked source counts, API hints, table/env references, migration collisions and large modules |
| api-spec-inventory.json | All TS/TSX API paths/methods compared with OpenAPI; duplicate YAML-key check |
| typecheck.txt / eslint.json | Passing TypeScript and lint with four warnings |
| vitest.json / vitest-console.txt | 163 files, 2,387 passing tests; nested suites inflate JSON suite count |
| node-tests.txt | Five tests excluded by Vitest patterns, 45 additional passing tests |
| dependency-import-check.txt | Import existence check; does not check security advisories |
| dependency-audit-network-enabled.json | Successful registry production audit, 35 entries / 29 unique IDs |
| build-network-enabled.txt | Successful production build with dummy configuration and network access for fonts |
| e2e.json / e2e-summary.json | Final corrected browser run: 49 passing, zero skipped/flaky/unexpected |
| e2e-network-enabled.txt | Mixed npm stdout and final Playwright JSON, parsed into the preceding artifacts |
| safe-reproductions.json | Mocked token/session, weekly notification and AI-call findings |
| env-validator-repro.txt | Dummy server-secret variable names rejected, exit 1 |
| env-scanner-repro.txt / scanner-fixture/canary.ts | Variable-name-only canary missed by quoted grep extension glob |
| github-open-issues.json / github-open-prs.json | All 124 open issue bodies and 23 PR metadata/check rollups |
| github-runs.json / github-main-*.json | Recent and main-specific workflow run/job snapshots |
| github-head-checks.json / github-head-status.json | Main-SHA check runs and statuses; paginated check data is an array of page objects |
| github-label-failure.txt | Assignment HTTP 403 in contributor labeling automation |
| github-dependabot-failure.txt | Dependency resolver/override failure |
| github-main-coverage.txt | Historical main coverage and Codecov upload problem |
| github-token-security-pr.json / github-share-dashboard-pr.json | Historical PR check metadata; expired logs unavailable |

## Earlier/incomplete attempts

build.txt records the initial sandbox font-download failure, superseded by the successful network-enabled build. dependency-audit.json records the initial restricted-network error, superseded by the successful registry audit. e2e-output.txt records the initial stalled/terminated sandbox run; it is not a completed test result. e2e-discovery.txt lists the 49 discovered cases. Earlier dummy-secret mismatch failures were overwritten by the final corrected run and are not application findings. Empty stderr files mean no captured stderr.

github-token-pr-failure.txt and github-share-pr-ci-failure.txt are empty because GitHub returned HTTP 410 for expired historical logs; metadata remains in the corresponding PR JSON files. This audit does not invent a root cause for those checks.

## Reproduction helpers

Run from repository root with existing dependencies. These commands do not fix code. build/browser checks write ignored local build/test artifacts; browser tests use the project's fixture/mocking setup. Python inventory/spec helpers require Python and, for OpenAPI, PyYAML. Environment helpers read dotenv key names and assign dummy child-process values; their output excludes local secret values. Run on an isolated local configuration.

```powershell
npm.cmd run type-check
node node_modules/eslint/bin/eslint.js src --format json --output-file docs/audits/2026-10-11/evidence/eslint.json
node scripts/check-deps.js
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=docs/audits/2026-10-11/evidence/vitest.json
node --experimental-strip-types --test test/check-deps.test.js test/crypto.test.js test/leaderboard-cache.test.mjs test/upstash-rest.test.mjs test/validate-github-username.test.js
pnpm.cmd audit --prod --json
node docs/audits/2026-10-11/evidence/run-isolated-build.cjs
node docs/audits/2026-10-11/evidence/run-isolated-e2e.cjs
node docs/audits/2026-10-11/evidence/safe-reproductions.cjs
node docs/audits/2026-10-11/evidence/reproduce-env-scanner.cjs
python docs/audits/2026-10-11/evidence/collect-inventory.py
python docs/audits/2026-10-11/evidence/collect-api-spec.py
python docs/audits/2026-10-11/evidence/generate-indexes.py
```

parse-e2e.py expects captured browser stdout in e2e-network-enabled.txt. normalize-evidence.py converts PowerShell UTF-16 redirection output to UTF-8 after writers finish. augment-report.py adds immutable source anchors/finding index and maintains editorial corrections; it is not an application patch. validate-docs.py checks artifact readability, local links, counts, and tracked Git changes. Generators do not re-fetch GitHub snapshots automatically.

The visual-regression suite and Docker build were not run. No live database query/migration, production-log lookup, notification delivery, or paid model invocation occurred. Unit/browser passes do not resolve the source findings.
