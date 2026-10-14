import pathlib,json,re,subprocess,collections,datetime
root=pathlib.Path.cwd(); base=root/'docs/audits/2026-10-11'; e=base/'evidence'
def git(*args):
    return subprocess.check_output(['git',*args],text=True,stderr=subprocess.PIPE).strip()
tracked_changes=git('diff','--name-only')
staged_changes=git('diff','--cached','--name-only')
if tracked_changes or staged_changes: raise SystemExit('Tracked source changes detected: '+tracked_changes+' '+staged_changes)
baseline={'captured_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'repo':'Priyanshu-byte-coder/devtrack','remote':git('remote','get-url','origin'),'branch':git('branch','--show-current'),'head':git('rev-parse','HEAD'),'origin_main':git('rev-parse','origin/main'),'commit_date':git('show','-s','--format=%cI','HEAD'),'commit_subject':git('show','-s','--format=%s','HEAD'),'tracked_changes':[],'staged_changes':[],'remote_branch_count':len(git('for-each-ref','--format=%(refname:short)','refs/remotes').splitlines()),'tag_count':len(git('tag','--list').splitlines()),'node':subprocess.check_output(['node','--version'],text=True).strip(),'pnpm':subprocess.check_output(['pnpm.cmd','--version'],text=True,shell=True).strip(),'preserved_preexisting_untracked':['.scannerwork/']}
(e/'baseline.json').write_text(json.dumps(baseline,indent=2)+'\n',encoding='utf-8')
problems=[]; parsed=0
for p in e.rglob('*.json'):
    try: json.loads(p.read_text(encoding='utf-8-sig')); parsed+=1
    except Exception as ex: problems.append(str(p.relative_to(base))+': '+str(ex))
for p in base.rglob('*.md'):
    content=p.read_text(encoding='utf-8-sig')
    for link in re.findall(r'\]\(([^)]+)\)',content):
        if link.startswith(('http:','https:','#')): continue
        path=link.split('#')[0].strip('<>')
        if path and not (p.parent/path).exists(): problems.append(str(p.relative_to(base))+' broken link '+link)
readme=(base/'README.md').read_text(encoding='utf-8-sig')
findings=re.findall(r'^### (AUD-\d+) · (P\d) ·',readme,re.M)
assert len(findings)==31 and len(set(x[0] for x in findings))==31
assert len(re.findall(r'^Source anchors:',readme,re.M))==31
api=json.loads((e/'api-spec-inventory.json').read_text(encoding='utf-8'))
issues=json.loads((e/'github-open-issues.json').read_text(encoding='utf-8'))
prs=json.loads((e/'github-open-prs.json').read_text(encoding='utf-8'))
audit=json.loads((e/'dependency-audit-network-enabled.json').read_text(encoding='utf-8'))
e2e=json.loads((e/'e2e-summary.json').read_text(encoding='utf-8'))
assert len(api['routes'])==108 and len(api['undocumented_routes'])==74
assert len(issues)==124 and len(prs)==23
assert len(audit['advisories'])==35
assert e2e['stats']['expected']==49 and e2e['stats']['unexpected']==0 and not e2e['failures']
assert all(('[#'+str(i['number'])+'](') in (base/'GITHUB_BACKLOG.md').read_text(encoding='utf-8') for i in issues+prs)
summary={'json_files_parsed':parsed,'findings':len(findings),'priorities':dict(collections.Counter(x[1] for x in findings)),'api_routes':len(api['routes']),'issues':len(issues),'prs':len(prs),'advisory_entries':len(audit['advisories']),'e2e':e2e['stats'],'tracked_changes':[],'broken_links_or_artifacts':problems}
(e/'documentation-validation.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,indent=2))
if problems: raise SystemExit(1)
