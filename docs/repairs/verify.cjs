// Reproducible local checks with UTF-8 logs and the child process's actual exit status.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
process.chdir(path.resolve(__dirname, "../.."));
const checks = {
  coverage: [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--coverage",
    "--maxWorkers=4",
    "--reporter=json",
    "--outputFile=docs/repairs/evidence/vitest-verified.json",
  ],
  lint: ["node_modules/eslint/bin/eslint.js", "src"],
  typecheck: ["node_modules/typescript/bin/tsc", "--noEmit"],
  node: [
    "--experimental-strip-types",
    "--test",
    ...fs
      .readdirSync("test")
      .filter((name) => /\.test\.(js|mjs)$/.test(name))
      .map((name) => "test/" + name),
  ],
  database: ["scripts/check-database.cjs"],
  "database-types": ["scripts/generate-database-types.cjs", "--check"],
  "database-contracts": ["scripts/check-database-contracts.cjs"],
  api: ["scripts/sync-openapi.cjs", "--check"],
  imports: ["scripts/check-deps.js"],
  "environment-security": ["scripts/check-env-security.js"],
  "dependency-audit": ["scripts/security-audit.cjs"],
  pwa: ["scripts/check-pwa.mjs"],
  build: ["docs/audits/2026-10-11/evidence/run-isolated-build.cjs"],
  browser: ["docs/audits/2026-10-11/evidence/run-isolated-e2e.cjs"],
  "browser-security": ["docs/repairs/run-security-browser.cjs"],
};
const name = process.argv[2];
if (!checks[name])
  throw Error(
    "Specify a supported check name: " + Object.keys(checks).join(", ")
  );
const started = Date.now();
const result = spawnSync(process.execPath, checks[name], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  env: {
    ...process.env,
    PLAYWRIGHT_JSON_OUTPUT_NAME: path.resolve(
      "docs/repairs/evidence/playwright-verified.json"
    ),
  },
});
fs.mkdirSync("docs/repairs/evidence", { recursive: true });
fs.writeFileSync(
  `docs/repairs/evidence/${name}-verified.log`,
  (result.stdout || "") + (result.stderr || "")
);
const report = {
  check: name,
  checkedAt: new Date().toISOString(),
  command: ["node", ...checks[name]],
  exitCode: result.status,
  signal: result.signal,
  durationSeconds: (Date.now() - started) / 1000,
};
if (result.error) report.error = result.error.code || result.error.name;
fs.writeFileSync(
  `docs/repairs/evidence/${name}-result.json`,
  JSON.stringify(report, null, 2) + "\n"
);
console.log(
  `${name}: ${result.status === 0 ? "PASS" : "FAIL"}, exit ${result.status}, ${report.durationSeconds.toFixed(1)}s`
);
process.exitCode = result.status ?? 1;
