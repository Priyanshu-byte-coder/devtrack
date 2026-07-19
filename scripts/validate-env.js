// Skip in CI — placeholder values are expected there
if (process.env.CI || process.env.GITHUB_ACTIONS) {
  console.log("✅ Environment validation skipped in CI.");
  process.exit(0);
}

const sensitivePatterns = [
  "private_key",
  "secret",
  "supabase_secret",
  "github_token",
  "token",
  "password",
  "api_key",
  "apikey",
];

let hasErrors = false;

console.log("🔍 Validating environment variables...");

for (const key of Object.keys(process.env)) {
  const lowerKey = key.toLowerCase();

  const isSensitive = sensitivePatterns.some((pattern) =>
    lowerKey.includes(pattern)
  );

  if (isSensitive && !key.startsWith("NEXT_PUBLIC_")) {
    console.error(`❌ Sensitive environment variable detected: ${key}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error("\n🚨 Build blocked: Private credentials detected.");
  process.exit(1);
}

console.log("✅ Environment validation passed.");
