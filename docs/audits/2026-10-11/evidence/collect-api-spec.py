import json,pathlib,re,yaml,collections
root=pathlib.Path.cwd(); e=root/'docs/audits/2026-10-11/evidence'; info=json.loads((e/'inventory.json').read_text(encoding='utf-8'))
all_routes=[]
for p in (root/'src/app/api').rglob('route.*'):
 if p.suffix not in ('.ts','.tsx','.js'): continue
 text=p.read_text(encoding='utf-8'); rel=p.relative_to(root).as_posix()
 methods=re.findall(r'export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE|OPTIONS|HEAD)\b',text)
 if 'export { handler as GET, handler as POST }' in text: methods=['GET','POST']
 url='/' + p.parent.relative_to(root/'src/app').as_posix(); url=re.sub(r'\[([^\]]+)\]',r'{\1}',url)
 all_routes.append({'file':rel,'path':url,'methods':methods})
class Unique(yaml.SafeLoader): pass
repeated=[]
def mapping(loader,node,deep=False):
 out={}
 for k,v in node.value:
  key=loader.construct_object(k,deep=deep)
  if key in out: repeated.append({'key':str(key),'line':k.start_mark.line+1})
  out[key]=loader.construct_object(v,deep=deep)
 return out
Unique.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,mapping)
spec=yaml.load((root/'public/openapi.yaml').read_text(encoding='utf-8'),Loader=Unique); documented=spec.get('paths',{})
actual={(r['path'],m.lower()) for r in all_routes for m in r['methods']}
doc={(p,m) for p,methods in documented.items() for m in methods if m in ['get','post','put','patch','delete','head','options']}
scanned={'route_files_all_extensions':len(all_routes),'routes':all_routes,'documented_paths':len(documented),'duplicate_openapi_keys':repeated,'undocumented_routes':sorted(set(p for p,m in actual)-set(documented)),'undocumented_operations':sorted(actual-doc),'documented_operations_without_matching_handler':sorted(doc-actual)}
(e/'api-spec-inventory.json').write_text(json.dumps(scanned,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in scanned.items() if k!='routes'},indent=2))
