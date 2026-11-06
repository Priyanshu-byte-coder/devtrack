import { describe, expect, it } from "vitest";
import { currentStreakCoverage, type ActiveDates } from "@/lib/streak-data";

function dates(
  list: string[],
  complete: boolean,
  partialReason?: string
): ActiveDates {
  return Object.assign(new Set(list), { complete, partialReason });
}

const TODAY = "2026-11-03";

describe("currentStreakCoverage", () => {
  it("trusts complete history", () => {
    expect(currentStreakCoverage(dates(["2026-11-03"], true), 1, TODAY)).toBe(
      "exact"
    );
  });

  it("is exact when the day that broke the streak is inside the fetched window", () => {
    // Search hit its cap but reached back to Oct 1; a 5-day streak ended its
    // gap on Oct 29, well inside that window.
    const d = dates(
      ["2026-10-01", "2026-10-30", "2026-11-03"],
      false,
      "GitHub Search limits results to 1,000 items"
    );
    expect(currentStreakCoverage(d, 5, TODAY)).toBe("exact");
  });

  it("is a lower bound when the streak runs back past the window", () => {
    // Window reaches back only 10 days and the streak covers all of them.
    const d = dates(
      ["2026-10-24", "2026-11-03"],
      false,
      "GitHub Search limits results to 1,000 items"
    );
    expect(currentStreakCoverage(d, 10, TODAY)).toBe("lower-bound");
  });

  it("treats the edge exactly: the breaking day must be strictly after the oldest day", () => {
    const d = dates(
      ["2026-10-24"],
      false,
      "Commit history exceeds the per-request page budget"
    );
    // Oldest Oct 24, so Oct 25 to Nov 3 (10 days) are fully covered. A streak
    // may end today or yesterday, so its breaking day can be as early as
    // today - (streak + 1); exact needs that inside the window: streak <= 8.
    expect(currentStreakCoverage(d, 8, TODAY)).toBe("exact");
    // At 9 the breaking day could be Oct 24 itself, which is only partly
    // fetched, so the rule stays conservative and reports a lower bound.
    expect(currentStreakCoverage(d, 9, TODAY)).toBe("lower-bound");
  });

  it("refuses when GitHub's search itself timed out", () => {
    const d = dates(
      ["2026-11-03"],
      false,
      "GitHub search reported incomplete results"
    );
    expect(currentStreakCoverage(d, 1, TODAY)).toBe("unknown");
  });

  it("refuses when nothing was fetched", () => {
    expect(currentStreakCoverage(dates([], false), 0, TODAY)).toBe("unknown");
  });
});
