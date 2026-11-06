const fs = require("node:fs");
const report = JSON.parse(
  fs.readFileSync("coverage/coverage-summary.json", "utf8")
);
const minimum = 30;
if (
  !Number.isFinite(report.total?.lines?.pct) ||
  report.total.lines.pct < minimum
) {
  console.error(
    `Line coverage ${report.total?.lines?.pct}% is below the enforced ${minimum}% baseline.`
  );
  process.exitCode = 1;
} else
  console.log(
    `Line coverage: ${report.total.lines.pct}% (minimum ${minimum}%).`
  );
