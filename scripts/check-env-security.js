const fs = require("node:fs");
const path = require("node:path");
const roots = process.argv.slice(2);
const forbidden =
  /NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|PASSWORD|TOKEN|API_KEY)[A-Z0-9_]*/g;
const failures = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next", "coverage"].includes(entry.name))
      continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(file)) {
      const matches = fs.readFileSync(file, "utf8").match(forbidden) || [];
      if (matches.length) failures.push(file);
    }
  }
}
(roots.length ? roots : ["src"]).forEach(scan);
if (failures.length) {
  console.error("Public secret references in:");
  failures.forEach((file) => console.error(file));
  process.exitCode = 1;
} else console.log("No public secret references found.");
