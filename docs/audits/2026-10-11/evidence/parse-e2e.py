import pathlib,json,re
p=pathlib.Path('docs/audits/2026-10-11/evidence'); raw=(p/'e2e-network-enabled.txt').read_bytes(); text=raw.decode('utf-16' if raw.startswith(b'\xff\xfe') else 'utf-8-sig',errors='replace'); data=None
for m in re.finditer(r'(?m)^\{',text):
 try:
  candidate,end=json.JSONDecoder().raw_decode(text[m.start():])
  if 'suites' in candidate and 'stats' in candidate: data=candidate; break
 except json.JSONDecodeError: pass
if data is None: raise SystemExit('No Playwright JSON report found')
(p/'e2e.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
failed=[]
def visit(suite):
 for spec in suite.get('specs',[]):
  for test in spec['tests']:
   if test.get('status') in ['unexpected','flaky']:
    item={'file':spec['file'],'line':spec['line'],'title':spec['title'],'status':test['status'],'errors':[error.get('message','') for result in test['results'] for error in result.get('errors',[])]};failed.append(item)
 for child in suite.get('suites',[]): visit(child)
for suite in data['suites']: visit(suite)
(p/'e2e-summary.json').write_text(json.dumps({'stats':data['stats'],'failures':failed},indent=2)+'\n',encoding='utf-8')
print('STATS',data['stats'])
for f in failed: print(f['file'],f['line'],f['title'],'\n', '\n'.join(f['errors'])[:1800])
