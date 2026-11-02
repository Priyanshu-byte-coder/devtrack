const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, imports, fakeFetch) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', 'process', 'fetch', code)(exports, id => {
    if (!(id in imports)) throw new Error('Unmocked dependency: ' + id);
    return imports[id];
  }, { env: {} }, fakeFetch || (() => { throw new Error('Network disabled in audit reproduction'); }));
  return exports;
}
async function main() {
  const out = {};
  const auth = load('src/lib/auth.ts', {
    'next-auth/providers/github': config => config,
    './github-achievements': { syncGitHubAchievementsForUser: async () => {} },
    './supabase': { supabaseAdmin: null },
  });
  const session = await auth.authOptions.callbacks.session({ session: {}, token: { accessToken: 'AUDIT_DUMMY_TOKEN', githubId: 'audit-id', githubLogin: 'audit-login' } });
  out.browserSessionToken = { reproduced: session.accessToken === 'AUDIT_DUMMY_TOKEN', requestedScopes: auth.authOptions.providers[0].authorization.params.scope, sessionKeys: Object.keys(session) };
  const sent = [];
  const users = [{ id: 'audit-user-a', github_login: 'audit-a', webhook_url: 'https://example.com/a' }, { id: 'audit-user-b', github_login: 'audit-b', webhook_url: 'https://example.com/b' }];
  const supabase = { from(table) {
    const query = { select() { return query; }, not() { return query; }, eq(key, value) { query.filter = [key, value]; return query; }, gte() { return query; }, lte() { return query; }, single() { return Promise.resolve({ data: users[0], error: null }); }, then(resolve, reject) { return Promise.resolve({ data: table === 'users' ? users : [], error: null }).then(resolve, reject); } };
    return query;
  } };
  const weekly = load('src/app/api/notifications/weekly/route.ts', { 'next/server': { NextResponse: { json: body => body } }, '@/lib/supabase': { supabaseAdmin: supabase } }, async url => { sent.push(url); return { ok: true }; });
  const get = await weekly.GET({ headers: new Headers() });
  out.weeklyWithoutAuth = { deliveries: sent.length, resultCount: get.results.length, exposesWebhookUrl: get.results.some(row => row.webhook), resultKeys: Object.keys(get.results[0]) };
  sent.length = 0;
  const post = await weekly.POST({ json: async () => ({ userId: 'audit-user-a' }), headers: new Headers() });
  out.weeklySingleUserPost = { requestedUser: 'audit-user-a', deliveredTo: sent, resultCount: post.results.length };
  let aiCalls = 0;
  const roast = load('src/app/api/ai/roast/route.ts', { 'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } }, '@google/generative-ai': { GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent: async () => { aiCalls++; return { response: { text: () => 'audit-mocked-response' } }; } }; } } } });
  const ai = await roast.POST({ json: async () => ({ mode: 'hype', stats: {} }), headers: new Headers() });
  out.aiRoastWithoutAuth = { modelCalls: aiCalls, status: ai.status };
  fs.writeFileSync('docs/audits/2026-10-11/evidence/safe-reproductions.json', JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
