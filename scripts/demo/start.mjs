// Starts DevTrack in offline demo mode (replays demo/fixtures.json).
// Uses the standalone production build when present (fast, no dev overlay), else next dev.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const root = process.cwd();
const fixtures = path.join(root, "demo", "fixtures.json");
if (!fs.existsSync(fixtures)) {
  console.error("demo/fixtures.json missing - run `pnpm demo:record <session-jwt-file>` first.");
  process.exit(1);
}
nextEnv.loadEnvConfig(root, false);

const port = process.env.PORT ?? "3000";
const server = path.join(root, ".next", "standalone", "server.js");
const built = fs.existsSync(server);
const command = built
  ? [server]
  : [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "--webpack", "-p", port];

console.log(`Demo mode (${built ? "production build" : "dev server"}) -> open http://localhost:${port}/demo`);
const child = spawn(process.execPath, command, {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: "localhost",
    DEMO_MODE: "true",
    DEMO_FIXTURES: fixtures,
    NEXTAUTH_URL: `http://localhost:${port}`,
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
