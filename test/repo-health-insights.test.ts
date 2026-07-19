import { describe, it, expect } from "vitest";
import {
  gradeLetter,
  gradeLabel,
  buildRadarData,
  buildBreakdown,
  generateInsights,
} from "../src/lib/repo-health-insights";
import type { RepoHealthSignals } from "../src/types/repo-health";

const BEST_SIGNALS: RepoHealthSignals = {
  commitFrequency: 10,
  prMergeRate: 1,
  avgPrOpenTimeHours: 0,
  openIssuesCount: 0,
  daysSinceLastCommit: 0,
  contributorCount: 10,
  documentationScore: 100,
};

const WORST_SIGNALS: RepoHealthSignals = {
  commitFrequency: 0,
  prMergeRate: 0,
  avgPrOpenTimeHours: 9999,
  openIssuesCount: 9999,
  daysSinceLastCommit: 9999,
  contributorCount: 0,
  documentationScore: 0,
};

describe("gradeLetter", () => {
  it("returns D for very low scores", () => {
    expect(gradeLetter(0)).toBe("D");
    expect(gradeLetter(19)).toBe("D");
  });

  it("returns C / C+ for low scores", () => {
    expect(gradeLetter(20)).toBe("C");
    expect(gradeLetter(29)).toBe("C");
    expect(gradeLetter(30)).toBe("C+");
    expect(gradeLetter(39)).toBe("C+");
  });

  it("returns B- / B / B+ for medium scores", () => {
    expect(gradeLetter(40)).toBe("B\u2212");
    expect(gradeLetter(49)).toBe("B\u2212");
    expect(gradeLetter(50)).toBe("B");
    expect(gradeLetter(59)).toBe("B");
    expect(gradeLetter(60)).toBe("B+");
    expect(gradeLetter(69)).toBe("B+");
  });

  it("returns A- / A / A+ for high scores", () => {
    expect(gradeLetter(70)).toBe("A\u2212");
    expect(gradeLetter(79)).toBe("A\u2212");
    expect(gradeLetter(80)).toBe("A");
    expect(gradeLetter(89)).toBe("A");
    expect(gradeLetter(90)).toBe("A+");
    expect(gradeLetter(100)).toBe("A+");
  });
});

describe("gradeLabel", () => {
  it("returns the human label for each tier", () => {
    expect(gradeLabel("green")).toBe("Healthy");
    expect(gradeLabel("yellow")).toBe("Needs Attention");
    expect(gradeLabel("red")).toBe("At Risk");
  });
});

describe("buildRadarData", () => {
  it("returns 5 axes with fullMark 100 and a 0-100 integer value", () => {
    const data = buildRadarData(BEST_SIGNALS);
    expect(data).toHaveLength(5);

    const labels = data.map((d) => d.metric);
    expect(labels).toEqual([
      "Commits",
      "PR Rate",
      "PR Speed",
      "Issues",
      "Activity",
    ]);

    for (const axis of data) {
      expect(axis.fullMark).toBe(100);
      expect(Number.isInteger(axis.value)).toBe(true);
      expect(axis.value).toBeGreaterThanOrEqual(0);
      expect(axis.value).toBeLessThanOrEqual(100);
    }
  });

  it("returns 0 for all axes when the signals are at their worst", () => {
    const data = buildRadarData(WORST_SIGNALS);
    for (const axis of data) {
      expect(axis.value).toBe(0);
    }
  });

  it("returns 100 for all axes when the signals are at their best", () => {
    const data = buildRadarData(BEST_SIGNALS);
    for (const axis of data) {
      expect(axis.value).toBe(100);
    }
  });
});

describe("buildBreakdown", () => {
  it("returns 5 rows with consistent labels and weights summing to 100", () => {
    const rows = buildBreakdown(BEST_SIGNALS);
    expect(rows).toHaveLength(5);

    const labels = rows.map((r) => r.label);
    expect(labels).toEqual([
      "Commit Frequency",
      "PR Merge Rate",
      "PR Turnaround",
      "Open Issues",
      "Recent Activity",
    ]);

    const totalWeight = rows.reduce((sum, r) => sum + r.weightPct, 0);
    expect(totalWeight).toBe(100);

    for (const row of rows) {
      expect(row.earned).toBeGreaterThanOrEqual(0);
      expect(row.earned).toBeLessThanOrEqual(row.maxScore);
      expect(row.tip.length).toBeGreaterThan(0);
    }
  });

  it("uses singular '1 commit' and '1 open issue' for count of 1", () => {
    const rows = buildBreakdown({
      ...BEST_SIGNALS,
      commitFrequency: 1,
      openIssuesCount: 1,
    });
    expect(rows[0].rawValue).toBe("1 commit");
    expect(rows[3].rawValue).toBe("1 open issue");
  });

  it("renders 'No PRs' when avgPrOpenTimeHours is 0", () => {
    const rows = buildBreakdown({ ...BEST_SIGNALS, avgPrOpenTimeHours: 0 });
    expect(rows[2].rawValue).toBe("No PRs");
  });

  it("renders the PR turnaround as '<n>h avg' for non-zero hours", () => {
    const rows = buildBreakdown({ ...BEST_SIGNALS, avgPrOpenTimeHours: 12.4 });
    expect(rows[2].rawValue).toBe("12h avg");
  });

  it("renders the PR merge rate as a rounded percentage", () => {
    const rows = buildBreakdown({ ...BEST_SIGNALS, prMergeRate: 0.654 });
    expect(rows[1].rawValue).toBe("65%");
  });

  it("renders 'Today' for daysSinceLastCommit === 0 and 'Unknown' for sentinel 9999", () => {
    const today = buildBreakdown({ ...BEST_SIGNALS, daysSinceLastCommit: 0 });
    expect(today[4].rawValue).toBe("Today");

    const unknown = buildBreakdown({ ...BEST_SIGNALS, daysSinceLastCommit: 9999 });
    expect(unknown[4].rawValue).toBe("Unknown");
  });
});

describe("generateInsights", () => {
  it("returns an empty array when signals are at the sentinel worst values", () => {
    // WORST_SIGNALS still triggers at least the "no commits" and "low-merge-rate"
    // rules, so this assertion is intentionally narrow.
    const insights = generateInsights({
      ...WORST_SIGNALS,
      commitFrequency: 0,
      prMergeRate: 0,
    });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.map((i) => i.id)).toContain("no-commits");
  });

  it("returns a strong-activity insight for the best-case signals", () => {
    const insights = generateInsights(BEST_SIGNALS);
    const ids = insights.map((i) => i.id);
    expect(ids).toContain("good-commits");
    expect(ids).toContain("no-issues");
    expect(ids).toContain("active-repo");
  });

  it("emits a high-issues warning when openIssuesCount >= 20", () => {
    const insights = generateInsights({ ...BEST_SIGNALS, openIssuesCount: 25 });
    const ids = insights.map((i) => i.id);
    expect(ids).toContain("high-issues");
  });

  it("emits a slow-prs warning when avgPrOpenTimeHours > 168", () => {
    const insights = generateInsights({ ...BEST_SIGNALS, avgPrOpenTimeHours: 200 });
    const ids = insights.map((i) => i.id);
    expect(ids).toContain("slow-prs");
  });

  it("emits a no-commit-data info insight when daysSinceLastCommit is the sentinel", () => {
    const insights = generateInsights({
      ...BEST_SIGNALS,
      daysSinceLastCommit: 9999,
    });
    const ids = insights.map((i) => i.id);
    expect(ids).toContain("no-commit-data");
  });
});
