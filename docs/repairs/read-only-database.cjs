// Read-only metadata and zero-row probes. No credentials or user records are written to evidence.
const fs = require('node:fs');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const report = { checkedAt: new Date().toISOString(), mode: 'read-only: OpenAPI metadata and limit=0 queries', schema: null, browserProbes: [] };
  if (!url || !serviceKey) { report.error = 'Database configuration unavailable'; }
  else {
    const base = new URL(url);
    if (base.protocol !== 'https:') throw Error('HTTPS required');
    // codeql[js/file-access-to-http]: local maintainer-run script against the
    // project's own schema.sql/Supabase project; table names are not attacker input.
    const request = (path, key, headers = {}) => fetch(new URL(path, base), { headers: { apikey: key, Authorization: `Bearer ${key}`, ...headers }, redirect: 'error', signal: AbortSignal.timeout(10000) });
    try {
      const res = await request('/rest/v1/', serviceKey, { Accept: 'application/openapi+json' });
      report.metadataStatus = res.status;
      if (res.ok) {
        const spec = await res.json();
        report.schema = Object.fromEntries(Object.entries(spec.definitions || {}).map(([table, definition]) => [table, Object.keys(definition.properties || {}).sort()]));
        const expected = fs.readFileSync('supabase/schema.sql','utf8');
        const tables = [...expected.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(match => match[1]);
        report.expectedTables = tables;
        report.missingTables = tables.filter(table => !(table in report.schema));
        if (anonKey) for (const table of tables) {
          const probe = await request(`/rest/v1/${table}?select=*&limit=0`, anonKey);
          report.browserProbes.push({ table, zeroRowStatus: probe.status });
          await probe.body?.cancel();
        }
      }
    } catch (error) { report.error = error.name === 'TimeoutError' ? 'Metadata probe timed out' : 'Metadata probe unavailable'; report.failureKind = error.cause?.code || error.name; }
  }
  // codeql[js/http-to-file-access]: writes the probe's own evidence report (metadata/
  // status codes only, no credentials/rows) to a local docs/ evidence file for review.
  fs.writeFileSync('docs/repairs/evidence/live-database-read-only.json', JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ metadataStatus: report.metadataStatus, tables: report.schema && Object.keys(report.schema).length, missingTables: report.missingTables, error: report.error, browserProbeCount: report.browserProbes.length }));
}
main().catch(() => { console.error('Read-only probe failed'); process.exitCode=1; });
