const fs = require('node:fs');
const cp = require('node:child_process');
const dir = 'docs/audits/2026-10-11/evidence/scanner-fixture';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + '/canary.ts', '// NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY audit dummy name only');
const bash = 'C:/Program Files/Git/bin/bash.exe';
if (!fs.existsSync(bash)) { console.log('Git Bash unavailable'); process.exit(0); }
const result = cp.spawnSync(bash, ['-c', "grep -r 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY' --include='*.{js,jsx,ts,tsx}' ."], { cwd: dir, encoding: 'utf8' });
console.log('canary present=true');
console.log('grep exit=' + result.status);
console.log(result.stdout);
console.log(result.stderr);
if (result.error) console.error(result.error.message);
