// Validate both injected and dotenv configuration, including CI builds.
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd(), process.env.NODE_ENV === 'development');
const errors = [];
for (const [name, value] of Object.entries(process.env)) {
  if (!value || !name.startsWith('NEXT_PUBLIC_')) continue;
  if (/(SECRET|PRIVATE_KEY|SERVICE_ROLE|PASSWORD|TOKEN|API_?KEY)/i.test(name) && name !== 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
    errors.push(`Private credential must not be public: ${name}`);
  }
}
if (process.env.ENCRYPTION_KEY && !/^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY)) errors.push('ENCRYPTION_KEY must contain exactly 64 hexadecimal characters');
for (const name of ['NEXTAUTH_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
  if (!process.env[name]) continue;
  try { const url = new URL(process.env[name]); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
  catch { errors.push(`${name} must be an HTTP(S) URL`); }
}
if (errors.length) { errors.forEach(error => console.error(error)); process.exitCode = 1; }
else console.log('Environment validation passed.');
