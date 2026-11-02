import collections,json,pathlib,re,subprocess
root=pathlib.Path.cwd(); evidence=root/'docs/audits/2026-10-11/evidence'
tracked=subprocess.check_output(['git','ls-files'],text=True).splitlines()
source={f:(root/f).read_text(encoding='utf-8',errors='replace') for f in tracked if f.startswith('src/') and pathlib.Path(f).suffix in ('.ts','.tsx','.js','.jsx')}
routes=[]
for f,s in source.items():
 if f.startswith('src/app/api/') and f.endswith('/route.ts'):
  routes.append({'path':'/api/'+f[len('src/app/api/'): -len('/route.ts')], 'file':f,'methods':re.findall(r'export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|OPTIONS|HEAD)\b',s),'session_check':bool(re.search(r'getServerSession|getSessionWithToken',s)),'cron_guard':'validateCronRequest' in s,'dynamic':bool(re.search(r'dynamic\s*=\s*[\'"]force-dynamic',s)),'runtime':re.findall(r'runtime\s*=\s*[\'"](\w+)',s)})
schema=(root/'supabase/schema.sql').read_text(); migrations={p.name:p.read_text() for p in (root/'supabase/migrations').glob('*') if p.is_file()}; sql=schema+'\n'+'\n'.join(migrations.values())
created=set(re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)',sql,re.I)); schema_tables=set(re.findall(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)',schema,re.I)); queried=collections.defaultdict(list)
for f,s in source.items():
 for table in set(re.findall(r'\.from\(\s*[\'"]([a-z_]+)',s)): queried[table].append(f)
rls=set(re.findall(r'alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_]+)\s+enable\s+row\s+level\s+security',sql,re.I)); schema_rls=set(re.findall(r'alter\s+table\s+(?:public\.)?([a-z_]+)\s+enable\s+row\s+level\s+security',schema,re.I))
prefixes=collections.defaultdict(list)
for f in migrations:
 m=re.match(r'(\d+)_',f)
 if m: prefixes[m[1]].append(f)
env=collections.defaultdict(list)
for f,s in source.items():
 for key in set(re.findall(r'process\.env\.([A-Z][A-Z0-9_]*)',s)): env[key].append(f)
unit_files=[f for f in tracked if re.search(r'\.test\.(?:ts|tsx|js|mjs)$',f)]
ignored_unit=[f for f in unit_files if not ((f.startswith('test/') or f.startswith('src/')) and re.search(r'\.test\.(?:ts|tsx)$',f))]
conflicts=[f for f,s in source.items() if re.search(r'^<{7} |^>{7} |^={7}$',s,re.M)]
info={'commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'tracked_files':len(tracked),'source_files':len(source),'source_lines':sum(len(s.splitlines()) for s in source.values()),'components':sum(f.startswith('src/components/') and f.endswith('.tsx') for f in source),'pages':sum(f.endswith('/page.tsx') for f in source),'route_files':len(routes),'migration_files':len(migrations),'routes':routes,'tables_queried':dict(sorted(queried.items())),'tables_created_in_schema':sorted(schema_tables),'tables_created_anywhere':sorted(created),'queried_not_created':sorted(set(queried)-created),'schema_missing_queried_tables':sorted(set(queried)-schema_tables),'schema_tables_without_rls_statement':sorted(schema_tables-schema_rls),'all_tables_without_rls_statement':sorted(created-rls),'duplicate_migration_versions':{k:v for k,v in prefixes.items() if len(v)>1},'nontimestamp_migrations':[f for f in migrations if not re.match(r'\d{14}_',f)],'env_variables':dict(sorted(env.items())),'unit_file_count':len(unit_files),'undiscovered_unit_files':ignored_unit,'merge_conflict_markers':conflicts,'largest_source_files':sorted([{'file':f,'lines':len(s.splitlines())} for f,s in source.items()],key=lambda x:x['lines'],reverse=True)[:25]}
(evidence/'inventory.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
for file in evidence.glob('github-*.json'):
 raw=file.read_bytes(); text=raw.decode('utf-16' if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig').strip()
 try: parsed=json.loads(text)
 except json.JSONDecodeError:
  parsed=[]; decoder=json.JSONDecoder()
  while text:
   item,end=decoder.raw_decode(text); parsed.append(item); text=text[end:].strip()
 file.write_text(json.dumps(parsed,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
checks=json.loads((evidence/'github-head-checks.json').read_text(encoding='utf-8')); checks=checks if isinstance(checks,list) else [checks]
print('COUNTS', {k:info[k] for k in ['tracked_files','source_files','source_lines','components','pages','route_files','migration_files','unit_file_count']})
for key in ['queried_not_created','schema_missing_queried_tables','schema_tables_without_rls_statement','all_tables_without_rls_statement','duplicate_migration_versions','nontimestamp_migrations','undiscovered_unit_files','merge_conflict_markers','largest_source_files']: print(key,json.dumps(info[key]))
print('HEAD CHECKS SUMMARY',collections.Counter((x['name'],x['conclusion']) for page in checks for x in page['check_runs']))
print('FAILED HEAD CHECKS',[(x['name'],x['conclusion'],x['details_url']) for page in checks for x in page['check_runs'] if x['conclusion'] in ('failure','timed_out','cancelled')][:30])
