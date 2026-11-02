const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyPatches } = require("./check-security-patches.cjs");
const patches = verifyPatches();
const cli = process.env.npm_execpath;
const options = { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 };
const args = ["audit", "--prod", "--json"];
const audit =
  cli && path.basename(cli).includes("pnpm")
    ? spawnSync(process.execPath, [cli, ...args], options)
    : spawnSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["exec", "--yes", "--package=pnpm@11.13.1", "--", "pnpm", ...args],
        { ...options, shell: process.platform === "win32" }
      );
if (audit.error) throw audit.error;
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error(audit.stderr || audit.stdout);
  throw new Error("Dependency audit did not return JSON");
}
if (report.error) throw new Error("Dependency registry audit unavailable");
let allowed = 0;
const unexpected = [];
for (const advisory of Object.values(report.advisories || {})) {
  const patch = patches.find(
    (p) =>
      p.advisory === advisory.github_advisory_id &&
      p.package === advisory.module_name
  );
  if (
    patch &&
    advisory.findings.every((finding) => finding.version === patch.version)
  )
    allowed++;
  else
    unexpected.push(
      `${advisory.module_name}: ${advisory.github_advisory_id} (${advisory.severity})`
    );
}
fs.mkdirSync("docs/repairs", { recursive: true });
fs.writeFileSync(
  "docs/repairs/dependency-audit.json",
  JSON.stringify(report, null, 2) + "\n"
);
if (unexpected.length) {
  console.error("Unmitigated production advisories:\n" + unexpected.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Production dependency audit passed: ${allowed} exact-version advisories mitigated by verified patches; no unmitigated advisories.`
  );
