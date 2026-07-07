/**
 * Tests for src/lib/personality-analysis.ts
 *
 * Coverage
 * --------
 * computePersonalityDimensions  -- Night Owl / Early Bird / 9-to-5, Sprinter / Marathoner,
 *                                    Solo Coder / Team Player / Open Source Hero, scores
 * buildFallbackReport           -- archetype selection, tagline, description, strengths, funFact
 */

import { describe, it, expect } from "vitest";
import {
  computePersonalityDimensions,
  buildFallbackReport,
} from "../src/lib/personality-analysis";
import type { PersonalityInputMetrics } from "../src/lib/personality-analysis";

function makeMetrics(overrides: Partial<PersonalityInputMetrics> = {}): PersonalityInputMetrics {
  return {
    timeBlocks: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    totalCommits: 100,
    activeDays: 50,
    longestStreak: 10,
    currentStreak: 5,
    prsMerged: 3,
    prsOpen: 2,
    avgMergeTimeDays: 1,
    topRepoName: "my-repo",
    repoCount: 2,
    commitsByDay: [],
    ...overrides,
  };
}

function makeCommitsByDay(counts: number[]) {
  return counts.map((count, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    count,
  }));
}

describe("computePersonalityDimensions", () => {
  it('classifies as Night Owl when night commits >= 35%', () => {
    const metrics = makeMetrics({
      timeBlocks: { morning: 10, afternoon: 10, evening: 10, night: 50 },
    });
    const dims = computePersonalityDimensions(metrics);
    expect(dims.workingStyle).toBe("Night Owl");
    expect(dims.nightCommitPct).toBe(63);
  });

  it('classifies as Early Bird when morning commits >= 35%', () => {
    const metrics = makeMetrics({
      timeBlocks: { morning: 50, afternoon: 10, evening: 10, night: 10 },
    });
    const dims = computePersonalityDimensions(metrics);
    expect(dims.workingStyle).toBe("Early Bird");
    expect(dims.morningCommitPct).toBe(63);
  });

  it('defaults to 9-to-5 Developer when no time block dominates', () => {
    const metrics = makeMetrics({
      timeBlocks: { morning: 10, afternoon: 20, evening: 20, night: 10 },
    });
    const dims = computePersonalityDimensions(metrics);
    expect(dims.workingStyle).toBe("9-to-5 Developer");
  });

  it("classifies Sprinter when burstiness >= 1.1", () => {
    // Few high-count days = high variance = Sprinter
    // 2 days with 100 commits, 3 days with 0: mean=40, CV≈1.41 -> Sprinter
    const metrics = makeMetrics({
      commitsByDay: [
        { date: "2026-01-01", count: 100 },
        { date: "2026-01-02", count: 100 },
        { date: "2026-01-03", count: 0 },
        { date: "2026-01-04", count: 0 },
        { date: "2026-01-05", count: 0 },
      ],
    });
    const dims = computePersonalityDimensions(metrics);
    expect(dims.commitPattern).toBe("Sprinter");
  });

  it("classifies Marathoner when burstiness < 1.1", () => {
    // Even counts = low variance = Marathoner
    const metrics = makeMetrics({
      commitsByDay: [
        { date: "2026-01-01", count: 5 },
        { date: "2026-01-02", count: 5 },
        { date: "2026-01-03", count: 5 },
      ],
    });
    const dims = computePersonalityDimensions(metrics);
    expect(dims.commitPattern).toBe("Marathoner");
  });

  it('classifies as Open Source Hero when repoCount >= 8', () => {
    const dims = computePersonalityDimensions(makeMetrics({ repoCount: 10 }));
    expect(dims.collaborationStyle).toBe("Open Source Hero");
  });

  it('classifies as Open Source Hero when prsMerged >= 15', () => {
    const dims = computePersonalityDimensions(makeMetrics({ prsMerged: 20 }));
    expect(dims.collaborationStyle).toBe("Open Source Hero");
  });

  it('classifies as Team Player when prsMerged >= 4', () => {
    const dims = computePersonalityDimensions(makeMetrics({ prsMerged: 5, repoCount: 2 }));
    expect(dims.collaborationStyle).toBe("Team Player");
  });

  it('classifies as Solo Coder otherwise', () => {
    const dims = computePersonalityDimensions(makeMetrics({ prsMerged: 2, repoCount: 1 }));
    expect(dims.collaborationStyle).toBe("Solo Coder");
  });

  it("perfectionismScore is between 0 and 100", () => {
    const dims = computePersonalityDimensions(makeMetrics());
    expect(dims.perfectionismScore).toBeGreaterThanOrEqual(0);
    expect(dims.perfectionismScore).toBeLessThanOrEqual(100);
  });

  it("clamps perfectionismScore to 100 even with large avgMergeTimeDays", () => {
    const dims = computePersonalityDimensions(makeMetrics({ avgMergeTimeDays: 100, activeDays: 100 }));
    expect(dims.perfectionismScore).toBeLessThanOrEqual(100);
  });
});

describe("buildFallbackReport", () => {
  it("includes archetype from ARCHETYPE_BY_STYLE lookup", () => {
    const dims = computePersonalityDimensions(makeMetrics({
      timeBlocks: { morning: 0, afternoon: 0, evening: 0, night: 100 },
      // spread commits over 100 days so CV is low -> Marathoner
      commitsByDay: Array.from({ length: 100 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, count: i < 80 ? 1 : 0 })),
    }));
    const report = buildFallbackReport(dims, { topRepoName: "my-repo", longestStreak: 7, prsMerged: 20 });
    expect(report.archetype).toBe("The Nocturnal Craftsman"); // Night Owl + Marathoner
    expect(report.source).toBe("fallback");
  });

  it("includes a tagline mentioning working style and commit pattern", () => {
    const dims = computePersonalityDimensions(makeMetrics({
      timeBlocks: { morning: 100, afternoon: 0, evening: 0, night: 0 },
      commitsByDay: makeCommitsByDay([5, 5, 5]),
    }));
    const report = buildFallbackReport(dims, { topRepoName: "test-repo", longestStreak: 3, prsMerged: 1 });
    expect(report.tagline).toContain("Early Bird");
    expect(report.tagline).toContain("marathoner");
  });

  it("includes at least three strengths", () => {
    const dims = computePersonalityDimensions(makeMetrics({ prsMerged: 20 }));
    const report = buildFallbackReport(dims, { topRepoName: "repo", longestStreak: 5, prsMerged: 20 });
    expect(report.strengths.length).toBeGreaterThanOrEqual(3);
  });

  it("funFact mentions the merged PR count", () => {
    const dims = computePersonalityDimensions(makeMetrics({ prsMerged: 12 }));
    const report = buildFallbackReport(dims, { topRepoName: "my-repo", longestStreak: 5, prsMerged: 12 });
    expect(report.funFact).toContain("12");
  });
});
