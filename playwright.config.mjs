import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3002);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const prepareStandaloneCommand =
  "node -e \"const fs=require('fs'); fs.cpSync('public','.next/standalone/public',{recursive:true,force:true}); fs.cpSync('.next/static','.next/standalone/.next/static',{recursive:true,force:true});\"";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  timeout: process.env.CI ? 60_000 : 120_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command:
      process.env.PLAYWRIGHT_SERVER_MODE === "start"
        ? `${prepareStandaloneCommand} && node .next/standalone/server.js`
        : `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXTAUTH_SECRET: "test-nextauth-secret-for-playwright-tests",
      NEXTAUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      GITHUB_ID: "playwright-github-id",
      GITHUB_SECRET: "playwright-github-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      PLAYWRIGHT_TEST: "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
