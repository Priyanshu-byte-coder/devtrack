#!/usr/bin/env node
/**
 * `pnpm dev:demo`: run DevTrack with the built-in demo data that the
 * end-to-end tests use. No Supabase project, GitHub OAuth app or API keys
 * needed, so you can explore and change the public pages (landing,
 * leaderboard, player cards, duels, top developers, guides) in minutes.
 *
 * Signing in still needs real GitHub OAuth credentials; see DEVELOPMENT.md.
 */
import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
const url = `http://localhost:${port}`;

const env = {
  ...process.env,
  // Switches data loaders to their deterministic fixtures.
  PLAYWRIGHT_TEST: "true",
  // Any username works in the lookups, with made-up sample stats.
  DEVTRACK_DEMO: "true",
  NEXTAUTH_SECRET: "devtrack-demo-secret-not-for-production",
  NEXTAUTH_URL: url,
  NEXT_PUBLIC_APP_URL: url,
  GITHUB_ID: "demo",
  GITHUB_SECRET: "demo",
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "demo",
  SUPABASE_SERVICE_ROLE_KEY: "demo",
};

console.log(
  `\n  ▲ DevTrack demo mode: built-in sample data, no accounts needed`
);
console.log(
  `  ▶ Open ${url}  (try ${url}/leaderboard and ${url}/u/playwright-user)\n`
);

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--webpack", "-p", port],
  { stdio: "inherit", env }
);
child.on("exit", (code) => process.exit(code ?? 0));
