import pathlib,re,json
root=pathlib.Path.cwd(); base=root/'docs/audits/2026-10-11'
for p in base.glob('*.md'):
    text=p.read_text(encoding='utf-8-sig').replace('next.config.ts','next.config.mjs')
    text=text.replace('rooms, room_members, room_messages, invitations','collaboration_rooms, room_members, room_messages, invitations')
    p.write_text(text,encoding='utf-8')
generator=base/'evidence/generate-indexes.py'
s=generator.read_text(encoding='utf-8-sig').replace("2564:'AUD-09: validator boundary remains incorrect in current source.'", "2564:'AUD-07: DNS validation and transport resolution remain separate; rebinding concern is current.'")
s=s.replace("2567:'Client/consolidation debt recorded under AUD-25; broader request needs acceptance review.'", "2567:'Date/repository utility consolidation request; overlapping modules remain, but safe behavioral consolidation needs acceptance review (AUD-31).'")
generator.write_text(s,encoding='utf-8')
p=base/'README.md'; text=p.read_text(encoding='utf-8')
text=text.replace('Repository metrics rely on recent/bounded selections; top-repository displays and PR breakdowns do not represent unlimited account history.', 'The repos route ranks repositories using a single page of the latest 100 matching commits, then returns the top six. That can bias rankings even within the requested period. PR breakdowns likewise do not represent unlimited account history.')
text=text.replace('The Compose example is described for production while running the development server and omitting CRON_SECRET.', 'The self-hosting guide describes Compose as production-ready, but the checked-in Compose file selects the development target/server and omits CRON_SECRET; the separate Docker development guide correctly calls it a development setup.')
text=text.replace('| Playwright | See browser result below |', '| Playwright | PASS, 49/49, no skips/flakes |')
refs={
1:[('src/app/api/notifications/weekly/route.ts','export async function GET')],
2:[('src/app/api/rooms/[roomId]/route.ts','session.user.name'),('src/lib/supabase-rooms.ts','github_username'),('src/app/api/rooms/[roomId]/members/[username]/route.ts','session.githubLogin')],
3:[('src/lib/auth.ts','session.accessToken ='),('next.config.mjs','script-src')],
4:[('package.json','"next"'),('src/app/u/[username]/opengraph-image.tsx','runtime')],
5:[('supabase/schema.sql','create table'),('supabase/migrations/20260610000000_add_milestones.sql','user_id')],
6:[('src/app/api/user/settings/route.ts','updates.webhook_url'),('src/app/api/notifications/weekly/route.ts','await fetch')],
7:[('src/lib/ssrf-protection.ts','dns.lookup'),('src/lib/webhooks.ts','dispatchWebhook')],
8:[('src/app/api/ai/roast/route.ts','export async function POST')],
9:[('scripts/validate-env.js','NEXT_PUBLIC_')],
10:[('scripts/check-env-security.sh','if grep')],
11:[('DEVELOPMENT.md','supabase/schema.sql'),('supabase/schema.sql','create table')],
12:[('supabase/migrations/20260610000000_add_milestones.sql','user_id'),('supabase/migrations/20250607_goal_history.sql','user_id')],
13:[('src/app/api/goals/sync/route.ts','id, unit, repo')],
14:[('vercel.json','/api/goals/sync'),('src/app/api/goals/sync/route.ts','export async function POST'),('src/app/api/cron/sync/route.ts','export async function POST')],
15:[('next.config.mjs','withPWAInit'),('package.json','"build"'),('src/components/OfflineBanner.tsx','register(')],
16:[('next.config.mjs','"worker-src blob:'),('src/components/OfflineBanner.tsx','register(')],
17:[('next.config.mjs','dashboard-api-cache')],
18:[('src/app/api/metrics/languages/route.ts','const since')],
19:[('src/app/api/badge/streak-shield/route.ts','since.setDate'),('src/app/api/metrics/streak/route.ts','timezone'),('src/lib/streak.ts','timeZone')],
20:[('src/app/api/metrics/contributions/route.ts','while (page <= 10)'),('src/app/api/metrics/repos/route.ts','per_page=100'),('src/app/api/metrics/prs/route.ts','per_page=100`,')],
21:[('src/app/api/ai-insights/route.ts','fetch(')],
22:[('src/middleware.ts','function getIp'),('src/lib/rate-limit.ts','function')],
23:[('src/components/rooms/MessageFeed.tsx',"table: 'messages'"),('src/lib/supabase-browser.ts','createUnavailableBrowserClient')],
24:[('src/hooks/useRealtimeSync.ts','case "SUBSCRIBED"'),('supabase/schema.sql','auth.uid()')],
25:[('src/types/supabase.ts','Tables:'),('src/lib/supabase-admin.ts','type SupabaseAdminClient'),('src/lib/supabase.ts','createUnavailable')],
26:[('Dockerfile','COPY package.json'),('pnpm-workspace.yaml','overrides:'),('.github/workflows/ci.yml','pnpm@11.12')],
27:[('render.yaml','buildCommand'),('docker-compose.yml','target: development'),('docs/self-hosting.md','production-ready')],
28:[('vitest.config.ts','include:'),('.github/workflows/ci.yml','continue-on-error'),('scripts/check-deps.js','')],
29:[('.github/workflows/gssoc-labels.yml','assignees'),('.github/dependabot.yml','updates:'),('pnpm-workspace.yaml','brace-expansion@1')],
30:[('public/openapi.yaml','paths:')],
31:[('src/app/dashboard/settings/page.tsx',''),('tsconfig.json','noImplicitAny'),('src/lib/github-app.ts','Concurrent callers')]
}
sha=json.loads((base/'evidence/inventory.json').read_text(encoding='utf-8'))['commit']
blob='https://github.com/Priyanshu-byte-coder/devtrack/blob/'+sha+'/'
for num,pairs in refs.items():
    links=[]
    for file,needle in pairs:
        lines=(root/file).read_text(encoding='utf-8').splitlines()
        line=next((i+1 for i,s in enumerate(lines) if needle in s),None)
        if line is None: raise SystemExit('Missing source anchor: '+file+' '+needle)
        links.append('['+file+':'+str(line)+']('+blob+file+'#L'+str(line)+')')
    pattern=r'(### AUD-'+str(num).zfill(2)+r'[^\n]*\n)(.*?)(?=\n### AUD-|\n## |\Z)'
    def add(match):
        body=match.group(2)
        if 'Source anchors:' not in body:
            body=body.replace('\nLater acceptance:', '\nSource anchors: '+', '.join(links)+'.\n\nLater acceptance:',1)
        return match.group(1)+body
    text=re.sub(pattern,add,text,flags=re.S)
for num in refs:
    heading='### AUD-'+str(num).zfill(2)
    anchor='<a id="aud-'+str(num).zfill(2)+'"></a>\n\n'
    if anchor+heading not in text: text=text.replace(heading,anchor+heading,1)
index=['## Finding index','','| ID | Priority | Finding |','|---|---|---|']
for num,priority,title in re.findall(r'### (AUD-\d+) · (P\d) · ([^\n]+)',text):
    index.append('| ['+num+'](#'+num.lower()+') | '+priority+' | '+title+' |')
marker='## Findings and repair priorities'
if '## Finding index' not in text: text=text.replace(marker,'\n'.join(index)+'\n\n'+marker,1)
p.write_text(text,encoding='utf-8')
print('Anchored',len(refs),'findings')

