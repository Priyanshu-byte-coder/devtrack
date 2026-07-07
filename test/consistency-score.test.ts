import { describe, it, expect } from "vitest";
import {
  isRecentlyActiveFromScore,
  type ConsistencyScoreResult,
} from "../src/lib/consistency-score";

// Helper: manually compute expected withoutRecent from the same formula
// used by isRecentlyActiveFromScore so tests are grounded in the actual logic.
function withoutRecent(data: ConsistencyScoreResult): number {
  const weeklyPoints = (data.weeklyConsistency / 100) * 40;
  const streakPoints = data.streakQuality * 30;
  const gapPoints = 20 - Math.min(20, data.longestGap / 7);
  return Math.round(
    Math.min(100, Math.max(0, weeklyPoints + streakPoints + gapPoints)),
  );
}

function makeResult(overrides: Partial<ConsistencyScoreResult>): ConsistencyScoreResult {
  return {
    score: 50,
    grade: "C",
    weeklyConsistency: 50,
    monthlyTrend: [],
    longestGap: 0,
    avgDailyCommits: 1,
    streakQuality: 0.5,
    improvementTip: "",
    ...overrides,
  };
}

describe("isRecentlyActiveFromScore", () => {
  // The function: recentPoints are embedded in score. withoutRecent is computed
  // from weeklyConsistency, streakQuality, and longestGap (all embedded).
  // Returns true when score - withoutRecent >= 10.

  it("returns true when score is well above withoutRecent", () => {
    // weekly=50→20pts, streak=0.5→15pts, gap=0→20pts → withoutRecent=55
    // score=80 → recent=25 ≥ 10 → true
    const result = makeResult({ score: 80, weeklyConsistency: 50, streakQuality: 0.5, longestGap: 0 });
    expect(withoutRecent(result)).toBe(55);
    expect(isRecentlyActiveFromScore(result)).toBe(true);
  });

  it("returns true when score - withoutRecent equals exactly 10", () => {
    // weekly=50→20pts, streak=0.5→15pts, gap=0→20pts → withoutRecent=55
    // score=65 → recent=10 ≥ 10 → true
    const result = makeResult({ score: 65, weeklyConsistency: 50, streakQuality: 0.5, longestGap: 0 });
    expect(withoutRecent(result)).toBe(55);
    expect(isRecentlyActiveFromScore(result)).toBe(true);
  });

  it("returns false when score - withoutRecent is 9 (just below threshold)", () => {
    // withoutRecent=55, score=64 → recent=9 < 10 → false
    const result = makeResult({ score: 64, weeklyConsistency: 50, streakQuality: 0.5, longestGap: 0 });
    expect(isRecentlyActiveFromScore(result)).toBe(false);
  });

  it("returns false when score - withoutRecent is 0 (no recent activity)", () => {
    // withoutRecent=55, score=55 → recent=0 < 10 → false
    const result = makeResult({ score: 55, weeklyConsistency: 50, streakQuality: 0.5, longestGap: 0 });
    expect(isRecentlyActiveFromScore(result)).toBe(false);
  });

  it("returns false when recent activity points are negative (score below withoutRecent)", () => {
    // withoutRecent=55, score=40 → recent=-15 < 10 → false
    const result = makeResult({ score: 40, weeklyConsistency: 50, streakQuality: 0.5, longestGap: 0 });
    expect(isRecentlyActiveFromScore(result)).toBe(false);
  });

  it("returns true when recent activity adds points at boundary with full weekly score", () => {
    // weekly=100→40pts, streak=0.667→20pts, gap=0→20pts → withoutRecent=80
    // score=100 → recent=20 ≥ 10 → true
    const result = makeResult({ score: 100, weeklyConsistency: 100, streakQuality: 0.667, longestGap: 0 });
    expect(withoutRecent(result)).toBe(80);
    expect(isRecentlyActiveFromScore(result)).toBe(true);
  });

  it("returns false when all metrics are maxed (no room for recent points)", () => {
    // weekly=100→40pts, streak=1.0→30pts, gap=0→20pts → withoutRecent=90
    // score=90 → recent=0 < 10 → false
    const result = makeResult({ score: 90, weeklyConsistency: 100, streakQuality: 1.0, longestGap: 0 });
    expect(withoutRecent(result)).toBe(90);
    expect(isRecentlyActiveFromScore(result)).toBe(false);
  });

  it("returns true when long gap reduces withoutRecent enough to make recent >= 10", () => {
    // weekly=0→0pts, streak=0→0pts, gap=140→20-20=0pts → withoutRecent=0
    // score=15 → recent=15 ≥ 10 → true
    const result = makeResult({ score: 15, weeklyConsistency: 0, streakQuality: 0, longestGap: 140 });
    expect(withoutRecent(result)).toBe(0);
    expect(isRecentlyActiveFromScore(result)).toBe(true);
  });
});
