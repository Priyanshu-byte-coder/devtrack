import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE_PATH = join(
  process.cwd(),
  "src/app/dashboard/page.tsx",
);

const FORBIDDEN_WIDGETS = [
  "RepoAnalyticsExplorer",
  "PRMetrics",
  "PRBreakdownChart",
  "PRReviewTrendChart",
] as const;

describe("dashboard page duplicate widget guard", () => {
  const pageSource = readFileSync(PAGE_PATH, "utf-8");

  it("delegates widgets to CustomizableDashboard", () => {
    expect(pageSource).toContain("CustomizableDashboard");
    expect(pageSource).toMatch(/<CustomizableDashboard\s*\/>/);
  });

  it("does not import duplicated analytics widgets directly", () => {
    for (const widget of FORBIDDEN_WIDGETS) {
      expect(pageSource).not.toMatch(
        new RegExp(`from\\s+["']@/components/.*${widget}`),
      );
      expect(pageSource).not.toMatch(
        new RegExp(`import\\(["']@/components/${widget}`),
      );
    }
  });

  it("does not render duplicated analytics widgets in JSX", () => {
    for (const widget of FORBIDDEN_WIDGETS) {
      expect(pageSource).not.toMatch(new RegExp(`<${widget}[\\s/>]`));
    }
  });
});
