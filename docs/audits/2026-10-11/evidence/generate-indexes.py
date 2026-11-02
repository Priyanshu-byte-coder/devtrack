import json, pathlib, collections
root = pathlib.Path.cwd()
out = root / 'docs/audits/2026-10-11'
e = out / 'evidence'
def read(name):
    raw = (e / name).read_bytes()
    return json.loads(raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig'))
def write(name, lines):
    (out / name).write_text('\n'.join(lines) + '\n', encoding='utf-8')
def cell(value):
    return str(value).replace('|', '\\|').replace('\r', ' ').replace('\n', ' ').strip()
def code(value):
    return '`' + cell(value) + '`'
info = read('inventory.json')
api = read('api-spec-inventory.json')
sha = info['commit']
blob = 'https://github.com/Priyanshu-byte-coder/devtrack/blob/' + sha + '/'
def source(file):
    return '[' + file + '](' + blob + file + ')'
lines = ['# Source inventory', '', 'Generated from tracked source at `' + sha + '`. See [findings](README.md). Regex-based inventories establish references, not authorization or a complete SQL parser. Database RLS/grants/publications were not queried live.', '', '## Counts', '', '| Item | Count |', '|---|---|']
for key in ['tracked_files','source_files','source_lines','components','pages','migration_files','unit_file_count']:
    lines.append('| ' + key + ' | ' + str(info[key]) + ' |')
lines += ['| API route files, all TS/TSX extensions | ' + str(api['route_files_all_extensions']) + ' |', '', 'inventory.json initially counted only route.ts (106); api-spec-inventory.json additionally includes the two route.tsx image handlers (108). Vitest file count is 163, with five additional standalone Node files (168 total unit-test files).', '', '## All API handlers', '', 'Brackets are rendered as OpenAPI-style braces below. NextAuth GET/POST aliases are included. A direct session/guard reference is an inventory hint only; helpers may perform checks, and a reference alone does not prove correct ownership.', '', '| Path | Methods | Source |', '|---|---|---|']
for r in sorted(api['routes'], key=lambda x:x['path']):
    lines.append('| ' + code(r['path']) + ' | ' + ', '.join(r['methods']) + ' | ' + source(r['file']) + ' |')
lines += ['', '## Database tables referenced by source', '', 'Missing from schema.sql means the documented bootstrap alone is incomplete; a table may exist in a later migration. No queried table was wholly absent from all SQL scanned. Missing explicit RLS is a source risk, not proof of live anonymous privileges.', '', '| Table | In schema.sql | Explicit RLS anywhere | Referencing modules |', '|---|---|---|---|']
no_rls = set(info['all_tables_without_rls_statement'])
for table, files in info['tables_queried'].items():
    lines.append('| ' + code(table) + ' | ' + ('yes' if table in info['tables_created_in_schema'] else 'no') + ' | ' + ('not found' if table in no_rls else 'found') + ' | ' + '<br>'.join(source(f) for f in files) + ' |')
for heading, key in [('Queried tables missing from bootstrap','schema_missing_queried_tables'),('Bootstrap tables without explicit RLS','schema_tables_without_rls_statement'),('All SQL tables without explicit RLS','all_tables_without_rls_statement')]:
    lines += ['', '### ' + heading, '', ', '.join(code(x) for x in info[key]) + '.']
lines += ['', '## Migration ordering collisions', '', 'Duplicate version prefixes: ' + str(len(info['duplicate_migration_versions'])) + '. Supabase applies versioned migrations, so filenames with a shared version require reconciliation. No migration was applied to a live database.', '', '| Version | Files |', '|---|---|']
for version, files in sorted(info['duplicate_migration_versions'].items()):
    lines.append('| ' + code(version) + ' | ' + '<br>'.join(source('supabase/migrations/' + f) for f in sorted(files)) + ' |')
lines += ['', 'Nonstandard migration filenames: ' + ', '.join(code(f) for f in info['nontimestamp_migrations']) + '.', '', 'Additional schema/foreign-key/column concerns are AUD-11/12/13 in the report; this list is not a substitute for a clean-database replay.', '', '## Environment names referenced in application source', '', 'Names only. No secret values were collected here. This scans direct process.env.NAME usage in source; deployment/scripts/SDK implicit variables and dynamic env indexing are outside this inventory.', '', '| Variable | Referencing files |', '|---|---|']
for name, files in info['env_variables'].items():
    lines.append('| ' + code(name) + ' | ' + '<br>'.join(source(f) for f in files) + ' |')
lines += ['', '## Largest source modules', '', '| Module | Lines |', '|---|---|']
for item in info['largest_source_files']:
    lines.append('| ' + source(item['file']) + ' | ' + str(item['lines']) + ' |')
lines += ['', '## Test discovery gap', '', 'Files omitted by current Vitest include patterns; all 45 tests passed under the standalone Node runner:', '']
lines += ['- ' + source(f) for f in info['undiscovered_unit_files']]
lines += ['', '## OpenAPI comparison', '', 'Source API route files: 108. Documented paths: ' + str(api['documented_paths']) + '. Undocumented source paths: ' + str(len(api['undocumented_routes'])) + '. Duplicate YAML keys: ' + str(len(api['duplicate_openapi_keys'])) + '.', '', '### Documented operations without a matching handler', '', '| Method | Path |', '|---|---|']
lines += ['| ' + method.upper() + ' | ' + code(path) + ' |' for path, method in api['documented_operations_without_matching_handler']]
lines += ['', '### Undocumented source paths', '']
lines += ['- ' + code(path) for path in api['undocumented_routes']]
lines += ['', 'All undocumented method/path pairs are preserved in [api-spec-inventory.json](evidence/api-spec-inventory.json). Request/response shapes and dynamically delegated behavior need separate contract validation.']
write('INVENTORY.md', lines)

issues = read('github-open-issues.json')
prs = read('github-open-prs.json')
triage = {
3170:'AUD-20: sequential pagination confirmed; production 504 not reproduced.',
3027:'AUD-19: badge/dashboard streak contract mismatch confirmed.',
2902:'AUD-20: repos route derives top repositories from one page of 100 commits, not a complete repository catalog; exact requested behavior needs acceptance review.',
2874:'AUD-26/27: deployment-contract risks confirmed; historical Docker incident not reproduced.',
2845:'AUD-03: session exposes token; claimed localStorage token setter not found in current source.',
2750:'Out of repository scope: report refers to Windows/C# files not present in tracked source.',
2751:'Out of repository scope: report refers to Windows/C# files not present in tracked source.',
2752:'Out of repository scope: report refers to Windows/C# files not present in tracked source.',
2668:'AUD-07: literal private-host blocking exists; DNS resolution is not pinned at dispatch.',
2564:'AUD-07: DNS validation and transport resolution remain separate; rebinding concern is current.',
2565:'Historical decode-after-strip premise changed: current code decodes before stripping; no general XSS exploit established.',
2585:'AUD-21: internal HTTP fan-out confirmed; alleged inevitable deadlock unverified.',
2567:'Date/repository utility consolidation request; overlapping modules remain, but safe behavioral consolidation needs acceptance review (AUD-31).',
2534:'Historical UI symptom not reproduced: checked current TSX samples have valid Unicode. Separate tracked comment mojibake exists (AUD-31).',
2450:'Related feature PR exists; completion/acceptance on main not assumed.',
2451:'UI loading-state request; existing skeleton usage does not establish every requested state.',
2310:'Partially addressed: dashboard uses stored timezone; badge/period inconsistencies remain (AUD-19).',
2299:'AUD-03: duplicate browser-session token exposure report.',
2175:'AUD-26/27: package-manager/runtime documentation divergence confirmed.',
2015:'Current config already emits X-XSS-Protection; requested absence is stale.',
2014:'CSP exists, but weak directives and worker mismatch remain (AUD-03/16).',
1235:'Funding configuration already exists; requested absence is stale.',
1209:'PR template already exists; requested absence is stale.',
979:'Historical production error not reproduced; schema/column drift provides candidates (AUD-11/13).',
858:'AUD-03: unsafe-inline/unsafe-eval CSP confirmed; no browser attack executed.',
856:'AUD-03: duplicate browser-session token exposure report.',
250:'Sponsor integration exists; acceptance against the requested feature remains unverified.',
176:'Webhook/SSE code exists; distributed in-process event delivery needs separate verification.',
171:'Digest code exists; operational scheduling/authorization requires review (AUD-01/14).',
164:'Error-boundary component exists; placement and feature acceptance remain unverified.',
135:'Partially addressed: contributions now paginates ten pages; current cap/deadline issues are AUD-20.',
94:'Drag-and-drop code exists; full feature acceptance remains unverified.'
}
def provisional(issue):
    if issue['number'] in triage: return triage[issue['number']]
    text = (issue['title'] + ' ' + ' '.join(label.get('name','') for label in issue.get('labels',[]))).lower()
    if 'bug' in text: return 'Reported bug; current main/runtime reproduction not established.'
    if any(word in text for word in ['feature','enhancement','request','suggestion']): return 'Feature request; current implementation/acceptance not independently established.'
    return 'Open report/task; current acceptance or root cause not independently established.'
lines = ['# GitHub backlog and failure context', '', 'Snapshot fetched on 2026-10-11 for [Priyanshu-byte-coder/devtrack](https://github.com/Priyanshu-byte-coder/devtrack). **' + str(len(issues)) + ' open issues; ' + str(len(prs)) + ' open PRs.** This is a provisional read-only index; nothing was assigned, labeled, closed, commented on, or merged.', '', 'Main baseline: `' + sha + '`. Recent branch failures must not be attributed to main without matching SHA evidence. Issue reports are not proof of current defects. Full fetched bodies/labels/check metadata are in evidence.', '', '## Established failure categories', '', '- Exact-main CI and automated-unit workflows passed; Vercel reports a completed deployment. Production request logs were not inspected.', '- Dependabot PRs #3523/#3522/#3521/#3519/#3518 fail Auto-apply type labels while application checks pass. Saved log shows HTTP 403 when assigning the bot author: [label failure](evidence/github-label-failure.txt).', '- Dependabot updating reports dependency_file_not_resolvable around multi-major brace-expansion overrides: [updater log](evidence/github-dependabot-failure.txt).', '- Star-required check failures implement repository contribution policy, not an app test failure.', '- PR #2875 has a failed aggregate CI check; #2323 has failed typecheck/lint/build/smoke/visual checks. Their historical logs returned HTTP 410 (expired); no specific root cause was recovered.', '- PR #2665 reports a failed Vercel check. Live deployment logs were not read.', '- PRs #2885/#2669/#2667 are explicitly CONFLICTING/DIRTY at the snapshot. UNKNOWN mergeability is not evidence of conflict.', '- Main coverage is 30.56% lines and Codecov reports Repository not found: [coverage log](evidence/github-main-coverage.txt).', '', '## Every open pull request', '', '| PR | Title | Branch | Merge state | Non-success / pending checks |', '|---|---|---|---|---|']
for pr in sorted(prs, key=lambda x:x['number'], reverse=True):
    statuses=[]
    for check in pr.get('statusCheckRollup') or []:
        name = check.get('name') or check.get('context') or 'unnamed'
        state = check.get('conclusion') or check.get('state') or check.get('status') or 'UNKNOWN'
        if state in ('SUCCESS','SKIPPED','NEUTRAL'): continue
        url = check.get('detailsUrl') or check.get('targetUrl')
        statuses.append(('[' + cell(name) + '](' + url + ')' if url else cell(name)) + ': ' + state)
    lines.append('| [#' + str(pr['number']) + '](' + pr['url'] + ') | ' + cell(pr['title']) + ' | ' + code(pr['headRefName']) + ' | ' + cell(pr['mergeable'] + '/' + pr['mergeStateStatus']) + ('; draft' if pr['isDraft'] else '') + ' | ' + ('<br>'.join(statuses) or 'No failing/pending checks in fetched rollup') + ' |')
lines += ['', '## Every open issue', '', 'Specific audit mappings below refer to [README.md](README.md). All other entries remain reports requiring reproduction or feature acceptance. Updated dates are UTC; body content may include contributor claims that this audit has not verified.', '', '| Issue | Title | Labels | Updated | Current triage |', '|---|---|---|---|---|']
for issue in sorted(issues, key=lambda x:x['number'], reverse=True):
    labels = ', '.join(label.get('name','') for label in issue.get('labels',[]))
    lines.append('| [#' + str(issue['number']) + '](' + issue['url'] + ') | ' + cell(issue['title']) + ' | ' + cell(labels or 'none') + ' | ' + issue['updatedAt'][:10] + ' | ' + cell(provisional(issue)) + ' |')
lines += ['', '## Source snapshots', '', '- [Open issue bodies](evidence/github-open-issues.json)', '- [Open PR metadata and all fetched checks](evidence/github-open-prs.json)', '- [Recent workflow runs](evidence/github-runs.json)', '- [Main CI runs](evidence/github-main-ci.json) and [unit runs](evidence/github-main-tests.json)', '- [Exact-SHA checks](evidence/github-head-checks.json) and [commit statuses](evidence/github-head-status.json)', '', 'No branch was merged to test a PR, and this report is not an approval to merge or close anything.']
write('GITHUB_BACKLOG.md', lines)

audit = read('dependency-audit-network-enabled.json')
advisories = list(audit.get('advisories', {}).values())
def ids(a):
    return a.get('github_advisory_id') or a.get('cves') or str(a.get('id'))
def installed(a):
    return ', '.join(sorted(set(f.get('version','unknown') for f in a.get('findings', []))))
lines = ['# Production dependency advisories', '', 'Snapshot: pnpm audit --prod --json on 2026-10-11, current lockfile at `' + sha + '`. Source: [raw audit](evidence/dependency-audit-network-enabled.json). No package or lockfile changes were made.', '', '**35 advisory entries, 29 unique GHSA IDs: 1 critical, 17 high, 14 moderate, 3 low.** Several IDs recur across installed brace-expansion majors. Severity is advisory metadata, not proof that each vulnerable code path is reachable in DevTrack. Some development-tool dependencies appear through production package trees.', '', 'The critical [Next ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) concerns the Node runtime handling attacker-controlled SVG attributes/styles/content. DevTrack has a Node public-profile OG image and two Edge API image routes; the specific vulnerable path was not reproduced. Do not describe this audit as a demonstrated RCE. The advisory is patched in 16.3.6, while other listed Next advisories require 16.3.8.', '', 'Several matching update PRs are open but blocked by contribution automation. Fixing that automation does not itself validate updated dependencies. Repair the lockfile/override contract and rerun build/tests/audit together during the later fix phase.', '', '## Every advisory entry', '', '| Severity | Package | Installed | Advisory | Patched range | Title |', '|---|---|---|---|---|---|']
order = {'critical':0,'high':1,'moderate':2,'low':3,'info':4}
for a in sorted(advisories, key=lambda x:(order.get(x.get('severity'),5),x.get('module_name',''),str(ids(x)))):
    ident = str(ids(a))
    url = a.get('url') or 'https://github.com/advisories/' + ident
    lines.append('| ' + a.get('severity','unknown') + ' | ' + code(a.get('module_name','')) + ' | ' + code(installed(a)) + ' | [' + cell(ident) + '](' + url + ') | ' + code(a.get('patched_versions','unknown')) + ' | ' + cell(a.get('title','')) + ' |')
lines += ['', '## Practical boundaries', '', 'The saved production audit excludes a complete development-only audit. It cannot establish image payload reachability, actual token compromise, or production exploitability. The report distinguishes these advisory results from the authorization defects independently confirmed in source/mocks. Resolve duplicated parallel-major overrides without blindly upgrading all consumers to one major.']
write('DEPENDENCIES.md', lines)
print('Generated indexes:', len(api['routes']), 'routes,', len(issues), 'issues,', len(prs), 'PRs,', len(advisories), 'advisories')
