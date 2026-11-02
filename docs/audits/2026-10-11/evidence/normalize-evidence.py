import pathlib,re,json
root=pathlib.Path.cwd(); e=root/'docs/audits/2026-10-11/evidence'
for p in e.glob('*.txt'):
 raw=p.read_bytes(); text=raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig',errors='replace'); p.write_text(text,encoding='utf-8')
for p in e.glob('*.json'):
 raw=p.read_bytes()
 if raw.startswith((b'\xff\xfe',b'\xfe\xff')): p.write_text(raw.decode('utf-16'),encoding='utf-8')
a=json.loads((e/'dependency-audit-network-enabled.json').read_text(encoding='utf-8')); print('unique GHSA',len(set(x['github_advisory_id'] for x in a['advisories'].values())))
for f,needle in [('src/app/api/notifications/weekly/route.ts','export async function GET'),('src/app/api/ai/roast/route.ts','export async function POST'),('src/lib/auth.ts','session.accessToken ='),('src/app/api/goals/sync/route.ts','select("id, unit'),('src/app/api/metrics/languages/route.ts','const since'),('src/middleware.ts','function getIp'),('next.config.mjs','worker-src blob'),('scripts/check-env-security.sh','if grep'),('src/hooks/useRealtimeSync.ts','case "SUBSCRIBED"'),('src/lib/supabase-admin.ts','type SupabaseAdminClient')]:
 lines=(root/f).read_text(encoding='utf-8').splitlines(); print(f,next((i+1 for i,s in enumerate(lines) if needle in s),1))
