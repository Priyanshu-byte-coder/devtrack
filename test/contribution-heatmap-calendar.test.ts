import { describe, it, expect } from "vitest";
import {
  buildHeatmap,
  buildMonthMarkers,
  countInRangeCommits,
  formatCellTooltip,
  formatCommitCount,
  formatDateKey,
} from "@/lib/contribution-heatmap";

describe("contribution-heatmap lib", () => {
  it("formatDateKey returns YYYY-MM-DD", () => {
    const date = new Date(2026, 2, 14);
    expect(formatDateKey(date)).toBe("2026-03-14");
  });

  it("formatCommitCount uses singular and plural", () => {
    expect(formatCommitCount(1)).toBe("1 contribution");
    expect(formatCommitCount(3)).toBe("3 contributions");
  });

  it("formatCellTooltip includes count and formatted date", () => {
    const date = new Date(2026, 2, 14);
    const tooltip = formatCellTooltip(3, date);
    expect(tooltip).toContain("3 contributions");
    expect(tooltip).toContain("Mar");
    expect(tooltip).toContain("14");
    expect(tooltip).toContain("2026");
  });

  it("buildHeatmap fills missing days with zero and marks inRange", () => {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const contributions = { [todayKey]: 2 };
    const cells = buildHeatmap(7, contributions);
    expect(cells.length % 7).toBe(0);
    const inRange = cells.filter((c) => c.inRange);
    expect(inRange.length).toBe(7);
    const match = cells.find((c) => c.dateKey === todayKey);
    expect(match?.count).toBe(2);
    const empty = inRange.find((c) => c.count === 0);
    expect(empty).toBeDefined();
  });

  it("buildHeatmap uses custom from/to range", () => {
    const cells = buildHeatmap(365, {}, "2026-01-01", "2026-01-07");
    const inRange = cells.filter((c) => c.inRange);
    expect(inRange.length).toBe(7);
    expect(inRange[0].dateKey).toBe("2026-01-01");
    expect(inRange[6].dateKey).toBe("2026-01-07");
  });

  it("buildMonthMarkers returns one marker per month in range", () => {
    const cells = buildHeatmap(60, {}, "2026-01-15", "2026-03-15");
    const weekCount = Math.ceil(cells.length / 7);
    const markers = buildMonthMarkers(cells, weekCount);
    expect(markers.length).toBeGreaterThanOrEqual(2);
    expect(markers[0].label).toBeTruthy();
  });

  it("countInRangeCommits sums only in-range cells", () => {
    const cells = buildHeatmap(7, {
      [formatDateKey(new Date())]: 4,
    });
    expect(countInRangeCommits(cells)).toBe(4);
  });
});
