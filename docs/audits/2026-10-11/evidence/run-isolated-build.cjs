// Audit helper: override every dotenv key so a build cannot use local credentials.
// Only key names are read; values are never printed or included in the evidence.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const env = { ...process.env };
for (const name of fs.readdirSync('.').filter(name => /^\.env(?:\.|$)/.test(name))) {
  for (const line of fs.readFileSync(name, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) env[match[1]] = '';
  }
}
Object.assign(env, {
  CI: 'true',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXTAUTH_SECRET: 'audit-placeholder-secret-for-local-checks',
  NEXTAUTH_URL: 'http://127.0.0.1:3002',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3002',
  GITHUB_ID: 'audit-placeholder',
  GITHUB_SECRET: 'audit-placeholder',
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  ENCRYPTION_KEY: '0'.repeat(64),
  CRON_SECRET: 'audit-placeholder-cron-secret',
  GITHUB_WEBHOOK_SECRET: 'audit-placeholder-webhook-secret',
});
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  env, stdio: 'inherit', shell: process.platform === 'win32',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
