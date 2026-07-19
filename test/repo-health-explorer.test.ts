/**
 * Tests for the Repository Health Explorer
 *
 * Covers:
 *  - Existing health scoring functions (regression — values must remain unchanged)
 *  - gradeLetter: full range including edge cases
 *  - gradeLabel: all three tiers
 *  - buildRadarData: normalisation, structure, boundary values
 *  - buildBreakdown: earned scores, maxScore, rawValue formatting
 *  - generateInsights: all five signal dimensions × multiple thresholds
 */

import { describe, expect, it } from "vitest";

import {
  computeHealthScore,
  gradeForScore,
  scoreCommitFrequency,
  scorePrMergeRate,
  scoreAvgPrOpenTimeHours,
  scoreOpenIssuesCount,
  scoreDaysSinceLastCommit,
} from "@/lib/repo-health";

import {
  buildBreakdown,
  buildRadarData,
  generateInsights,
  gradeLetter,
  gradeLabel,
} from "@/lib/repo-health-insights";

import type { RepoHealthSignals } from "@/types/repo-health";

// ---------------------------------------------------------------------------
// Helper fixtures
// ---------------------------------------------------------------------------

const perfectSignals: RepoHealthSignals = {
  commitFrequency: 10,
  prMergeRate: 1,
  avgPrOpenTimeHours: 0,
  openIssuesCount: 0,
  daysSinceLastCommit: 0,
  contributorCount: 10,
  documentationScore: 100,
};

const worstSignals: RepoHealthSignals = {
  commitFrequency: 0,
  prMergeRate: 0,
  avgPrOpenTimeHours: 9999,
  openIssuesCount: 999,
  daysSinceLastCommit: 9999,
  contributorCount: 0,
  documentationScore: 0,
};

const midSignals: RepoHealthSignals = {
  commitFrequency: 5,
  prMergeRate: 0.6,
  avgPrOpenTimeHours: 48,
  openIssuesCount: 8,
  daysSinceLastCommit: 10,
  contributorCount: 5,
  documentationScore: 50,
};

// ---------------------------------------------------------------------------
// Regression: existing health scoring functions
// (These tests guard against accidental changes to the scoring logic.)
// ---------------------------------------------------------------------------

describe("scoreCommitFrequency (regression)", () => {
  it("returns 25 for 10+ commits", () => {
    expect(scoreCommitFrequency(10)).toBe(25);
    expect(scoreCommitFrequency(100)).toBe(25);
  });

  it("returns 0 for 0 commits", () => {
    expect(scoreCommitFrequency(0)).toBe(0);
  });

  it("returns 12.5 for 5 commits (50% of max)", () => {
    expect(scoreCommitFrequency(5)).toBe(12.5);
  });
});

describe("scorePrMergeRate (regression)", () => {
  it("returns 25 for rate 1.0", () => {
    expect(scorePrMergeRate(1)).toBe(25);
  });

  it("returns 0 for rate 0", () => {
    expect(scorePrMergeRate(0)).toBe(0);
  });

  it("returns 12.5 for rate 0.5", () => {
    expect(scorePrMergeRate(0.5)).toBe(12.5);
  });

  it("clamps to 25 for rate > 1", () => {
    expect(scorePrMergeRate(2)).toBe(25);
  });
});

describe("scoreAvgPrOpenTimeHours (regression)", () => {
  it("returns 20 for 0 hours", () => {
    expect(scoreAvgPrOpenTimeHours(0)).toBe(20);
  });

  it("returns 20 for exactly 24 hours", () => {
    expect(scoreAvgPrOpenTimeHours(24)).toBe(20);
  });

  it("returns 0 for 168 hours or more", () => {
    expect(scoreAvgPrOpenTimeHours(168)).toBe(0);
    expect(scoreAvgPrOpenTimeHours(9999)).toBe(0);
  });

  it("scales linearly between 24 and 168 hours", () => {
    const score = scoreAvgPrOpenTimeHours(96);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(20);
  });
});

describe("scoreOpenIssuesCount (regression)", () => {
  it("returns 15 for 0 issues", () => {
    expect(scoreOpenIssuesCount(0)).toBe(15);
  });

  it("returns 0 for 20+ issues", () => {
    expect(scoreOpenIssuesCount(20)).toBe(0);
    expect(scoreOpenIssuesCount(100)).toBe(0);
  });

  it("scales linearly between 0 and 20 issues", () => {
    const score = scoreOpenIssuesCount(10);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(15);
  });
});

describe("scoreDaysSinceLastCommit (regression)", () => {
  it("returns 15 for 0 days", () => {
    expect(scoreDaysSinceLastCommit(0)).toBe(15);
  });

  it("returns 15 for exactly 7 days", () => {
    expect(scoreDaysSinceLastCommit(7)).toBe(15);
  });

  it("returns 0 for 30+ days", () => {
    expect(scoreDaysSinceLastCommit(30)).toBe(0);
    expect(scoreDaysSinceLastCommit(9999)).toBe(0);
  });

  it("scales between 7 and 30 days", () => {
    const score = scoreDaysSinceLastCommit(14);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(15);
  });
});

describe("gradeForScore (regression)", () => {
  it("returns green for scores 70+", () => {
    expect(gradeForScore(70)).toBe("green");
    expect(gradeForScore(100)).toBe("green");
  });

  it("returns yellow for scores 40-69", () => {
    expect(gradeForScore(40)).toBe("yellow");
    expect(gradeForScore(69)).toBe("yellow");
  });

  it("returns red for scores below 40", () => {
    expect(gradeForScore(0)).toBe("red");
    expect(gradeForScore(39)).toBe("red");
  });
});

describe("computeHealthScore (regression)", () => {
  it("returns score 100 for perfect signals", () => {
    const result = computeHealthScore("owner/repo", perfectSignals);
    expect(result.score).toBe(100);
    expect(result.grade).toBe("green");
  });

  it("returns score 0 for worst-case signals", () => {
    const result = computeHealthScore("owner/repo", worstSignals);
    expect(result.score).toBe(0);
    expect(result.grade).toBe("red");
  });

  it("includes the repo name in the result", () => {
    const result = computeHealthScore("my-org/my-repo", perfectSignals);
    expect(result.repo).toBe("my-org/my-repo");
  });

  it("includes the original signals in the result", () => {
    const result = computeHealthScore("owner/repo", midSignals);
    expect(result.signals).toEqual(midSignals);
  });
});

// ---------------------------------------------------------------------------
// gradeLetter
// ---------------------------------------------------------------------------

describe("gradeLetter", () => {
  it("returns A+ for scores 90-100", () => {
    expect(gradeLetter(90)).toBe("A+");
    expect(gradeLetter(100)).toBe("A+");
  });

  it("returns A for scores 80-89", () => {
    expect(gradeLetter(80)).toBe("A");
    expect(gradeLetter(89)).toBe("A");
  });

  it("returns A− for scores 70-79", () => {
    expect(gradeLetter(70)).toBe("A−");
    expect(gradeLetter(79)).toBe("A−");
  });

  it("returns B+ for scores 60-69", () => {
    expect(gradeLetter(60)).toBe("B+");
    expect(gradeLetter(69)).toBe("B+");
  });

  it("returns B for scores 50-59", () => {
    expect(gradeLetter(50)).toBe("B");
    expect(gradeLetter(59)).toBe("B");
  });

  it("returns B− for scores 40-49", () => {
    expect(gradeLetter(40)).toBe("B−");
    expect(gradeLetter(49)).toBe("B−");
  });

  it("returns C+ for scores 30-39", () => {
    expect(gradeLetter(30)).toBe("C+");
    expect(gradeLetter(39)).toBe("C+");
  });

  it("returns C for scores 20-29", () => {
    expect(gradeLetter(20)).toBe("C");
    expect(gradeLetter(29)).toBe("C");
  });

  it("returns D for scores below 20", () => {
    expect(gradeLetter(0)).toBe("D");
    expect(gradeLetter(19)).toBe("D");
  });
});

// ---------------------------------------------------------------------------
// gradeLabel
// ---------------------------------------------------------------------------

describe("gradeLabel", () => {
  it("returns Healthy for green", () => {
    expect(gradeLabel("green")).toBe("Healthy");
  });

  it("returns Needs Attention for yellow", () => {
    expect(gradeLabel("yellow")).toBe("Needs Attention");
  });

  it("returns At Risk for red", () => {
    expect(gradeLabel("red")).toBe("At Risk");
  });
});

// ---------------------------------------------------------------------------
// buildRadarData
// ---------------------------------------------------------------------------

describe("buildRadarData", () => {
  it("returns exactly 5 entries", () => {
    expect(buildRadarData(perfectSignals)).toHaveLength(5);
  });

  it("every entry has fullMark = 100", () => {
    for (const datum of buildRadarData(midSignals)) {
      expect(datum.fullMark).toBe(100);
    }
  });

  it("all entries are 100 for perfect signals", () => {
    const data = buildRadarData(perfectSignals);
    for (const datum of data) {
      expect(datum.value).toBe(100);
    }
  });

  it("all entries are 0 for worst-case signals", () => {
    const data = buildRadarData(worstSignals);
    for (const datum of data) {
      expect(datum.value).toBe(0);
    }
  });

  it("values are in the range 0-100", () => {
    const data = buildRadarData(midSignals);
    for (const datum of data) {
      expect(datum.value).toBeGreaterThanOrEqual(0);
      expect(datum.value).toBeLessThanOrEqual(100);
    }
  });

  it("has the expected metric labels in order", () => {
    const labels = buildRadarData(perfectSignals).map((d) => d.metric);
    expect(labels).toEqual(["Commits", "PR Rate", "PR Speed", "Issues", "Activity"]);
  });

  it("Commits entry is proportional to scoreCommitFrequency", () => {
    const signals: RepoHealthSignals = { ...perfectSignals, commitFrequency: 5 };
    const data = buildRadarData(signals);
    const commits = data.find((d) => d.metric === "Commits")!;
    // 5 commits = 12.5/25 * 100 = 50
    expect(commits.value).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// buildBreakdown
// ---------------------------------------------------------------------------

describe("buildBreakdown", () => {
  it("returns exactly 5 rows", () => {
    expect(buildBreakdown(perfectSignals)).toHaveLength(5);
  });

  it("weights sum to 100", () => {
    const total = buildBreakdown(perfectSignals).reduce(
      (sum, row) => sum + row.weightPct,
      0
    );
    expect(total).toBe(100);
  });

  it("maxScores sum to 100", () => {
    const total = buildBreakdown(perfectSignals).reduce(
      (sum, row) => sum + row.maxScore,
      0
    );
    expect(total).toBe(100);
  });

  it("earned scores match the scoring functions for perfect signals", () => {
    const rows = buildBreakdown(perfectSignals);
    const commitRow = rows.find((r) => r.label === "Commit Frequency")!;
    const prRateRow = rows.find((r) => r.label === "PR Merge Rate")!;

    expect(commitRow.earned).toBe(Math.round(scoreCommitFrequency(perfectSignals.commitFrequency)));
    expect(prRateRow.earned).toBe(Math.round(scorePrMergeRate(perfectSignals.prMergeRate)));
  });

  it("earned is 0 for worst-case signals", () => {
    const rows = buildBreakdown(worstSignals);
    for (const row of rows) {
      expect(row.earned).toBe(0);
    }
  });

  it("formats zero PR open time as No PRs", () => {
    const rows = buildBreakdown({ ...perfectSignals, avgPrOpenTimeHours: 0 });
    const prRow = rows.find((r) => r.label === "PR Turnaround")!;
    expect(prRow.rawValue).toBe("No PRs");
  });

  it("formats daysSinceLastCommit >= 9999 as Unknown", () => {
    const rows = buildBreakdown(worstSignals);
    const actRow = rows.find((r) => r.label === "Recent Activity")!;
    expect(actRow.rawValue).toBe("Unknown");
  });

  it("formats 0 daysSinceLastCommit as Today", () => {
    const rows = buildBreakdown({ ...perfectSignals, daysSinceLastCommit: 0 });
    const actRow = rows.find((r) => r.label === "Recent Activity")!;
    expect(actRow.rawValue).toBe("Today");
  });

  it("formats 1 commit as singular", () => {
    const rows = buildBreakdown({ ...perfectSignals, commitFrequency: 1 });
    const row = rows.find((r) => r.label === "Commit Frequency")!;
    expect(row.rawValue).toBe("1 commit");
  });
});

// ---------------------------------------------------------------------------
// generateInsights
// ---------------------------------------------------------------------------

describe("generateInsights — commit frequency", () => {
  it("emits a warning for 0 commits", () => {
    const insights = generateInsights({ ...perfectSignals, commitFrequency: 0 });
    const i = insights.find((x) => x.id === "no-commits");
    expect(i).toBeDefined();
    expect(i!.severity).toBe("warning");
    expect(i!.metric).toBe("Commit Frequency");
  });

  it("emits a warning for < 3 commits", () => {
    const insights = generateInsights({ ...perfectSignals, commitFrequency: 2 });
    expect(insights.find((x) => x.id === "low-commits")).toBeDefined();
  });

  it("emits a success for 10+ commits", () => {
    const insights = generateInsights({ ...perfectSignals, commitFrequency: 15 });
    expect(insights.find((x) => x.id === "good-commits")).toBeDefined();
  });

  it("emits no commit insight for 3–9 commits", () => {
    const insights = generateInsights({ ...perfectSignals, commitFrequency: 6 });
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain("no-commits");
    expect(ids).not.toContain("low-commits");
    expect(ids).not.toContain("good-commits");
  });
});

describe("generateInsights — PR merge rate", () => {
  it("emits a warning for rate > 0 and < 0.5", () => {
    const insights = generateInsights({ ...perfectSignals, prMergeRate: 0.3 });
    expect(insights.find((x) => x.id === "low-merge-rate")).toBeDefined();
  });

  it("emits a success for rate >= 0.8", () => {
    const insights = generateInsights({ ...perfectSignals, prMergeRate: 0.9 });
    expect(insights.find((x) => x.id === "good-merge-rate")).toBeDefined();
  });

  it("emits no PR rate insight for rate 0 (no PRs opened)", () => {
    const insights = generateInsights({ ...perfectSignals, prMergeRate: 0 });
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain("low-merge-rate");
    expect(ids).not.toContain("good-merge-rate");
  });
});

describe("generateInsights — PR turnaround", () => {
  it("emits a warning for > 168 hours", () => {
    const insights = generateInsights({ ...perfectSignals, avgPrOpenTimeHours: 200 });
    expect(insights.find((x) => x.id === "slow-prs")).toBeDefined();
  });

  it("emits an info for 72–168 hours", () => {
    const insights = generateInsights({ ...perfectSignals, avgPrOpenTimeHours: 100 });
    expect(insights.find((x) => x.id === "moderate-prs")).toBeDefined();
  });

  it("emits a success for <= 24 hours (and > 0)", () => {
    const insights = generateInsights({ ...perfectSignals, avgPrOpenTimeHours: 12 });
    expect(insights.find((x) => x.id === "fast-prs")).toBeDefined();
  });

  it("emits no PR speed insight for 0 hours", () => {
    const insights = generateInsights({ ...perfectSignals, avgPrOpenTimeHours: 0 });
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain("fast-prs");
    expect(ids).not.toContain("slow-prs");
    expect(ids).not.toContain("moderate-prs");
  });
});

describe("generateInsights — open issues", () => {
  it("emits a warning for >= 20 issues", () => {
    const insights = generateInsights({ ...perfectSignals, openIssuesCount: 25 });
    expect(insights.find((x) => x.id === "high-issues")).toBeDefined();
  });

  it("emits an info for 11–19 issues", () => {
    const insights = generateInsights({ ...perfectSignals, openIssuesCount: 15 });
    expect(insights.find((x) => x.id === "moderate-issues")).toBeDefined();
  });

  it("emits a success for 0 issues", () => {
    const insights = generateInsights({ ...perfectSignals, openIssuesCount: 0 });
    expect(insights.find((x) => x.id === "no-issues")).toBeDefined();
  });

  it("emits no issue insight for 1–10 issues", () => {
    const insights = generateInsights({ ...perfectSignals, openIssuesCount: 5 });
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain("no-issues");
    expect(ids).not.toContain("high-issues");
    expect(ids).not.toContain("moderate-issues");
  });
});

describe("generateInsights — recent activity", () => {
  it("emits an info for daysSinceLastCommit >= 9999", () => {
    const insights = generateInsights({ ...perfectSignals, daysSinceLastCommit: 9999 });
    expect(insights.find((x) => x.id === "no-commit-data")).toBeDefined();
  });

  it("emits a warning for >= 30 days", () => {
    const insights = generateInsights({ ...perfectSignals, daysSinceLastCommit: 45 });
    expect(insights.find((x) => x.id === "stale-repo")).toBeDefined();
  });

  it("emits an info for 15–29 days", () => {
    const insights = generateInsights({ ...perfectSignals, daysSinceLastCommit: 20 });
    expect(insights.find((x) => x.id === "low-activity")).toBeDefined();
  });

  it("emits a success for <= 3 days", () => {
    const insights = generateInsights({ ...perfectSignals, daysSinceLastCommit: 2 });
    expect(insights.find((x) => x.id === "active-repo")).toBeDefined();
  });

  it("emits a success for 0 days (today)", () => {
    const insights = generateInsights({ ...perfectSignals, daysSinceLastCommit: 0 });
    const i = insights.find((x) => x.id === "active-repo");
    expect(i).toBeDefined();
    expect(i!.description).toContain("today");
  });

  it("emits no recency insight for 4–14 days (neutral zone)", () => {
    const insights = generateInsights({ ...perfectSignals, daysSinceLastCommit: 9 });
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain("active-repo");
    expect(ids).not.toContain("low-activity");
    expect(ids).not.toContain("stale-repo");
  });
});

describe("generateInsights — severity ordering helpers", () => {
  it("all insights have one of the three valid severity values", () => {
    const insights = generateInsights(midSignals);
    const valid = new Set(["warning", "info", "success"]);
    for (const i of insights) {
      expect(valid).toContain(i.severity);
    }
  });

  it("all insights have non-empty id, title, description and metric", () => {
    const insights = generateInsights(midSignals);
    for (const i of insights) {
      expect(i.id.length).toBeGreaterThan(0);
      expect(i.title.length).toBeGreaterThan(0);
      expect(i.description.length).toBeGreaterThan(0);
      expect(i.metric.length).toBeGreaterThan(0);
    }
  });
});
