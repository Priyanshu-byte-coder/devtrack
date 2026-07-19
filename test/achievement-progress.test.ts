/**
 * Tests for src/lib/achievement-progress.ts
 *
 * Coverage
 * --------
 * computeMilestoneProgress    -- boundary cases, empty milestones, clamping
 * estimatePullSharkProgress   -- Bronze/Silver/Gold tiers, description, currentValue
 * estimateGalaxyBrainProgress -- same coverage for Galaxy Brain thresholds
 * getQuickdrawProgress        -- dataAvailable: false, correct title/slug
 * getPairExtraordinaireProgress -- dataAvailable: false, correct title/slug
 * buildLockedAchievementProgress -- omission, null data, mixed batches, full-unlock
 */

import { describe, it, expect } from "vitest";
import {
  computeMilestoneProgress,
  estimatePullSharkProgress,
  estimateGalaxyBrainProgress,
  getQuickdrawProgress,
  getPairExtraordinaireProgress,
  buildLockedAchievementProgress,
  type AchievementMilestone,
} from "@/lib/achievement-progress";

// --- computeMilestoneProgress ------------------------------------------------

describe("computeMilestoneProgress", () => {
  const milestones: AchievementMilestone[] = [
    { tier: "Bronze", threshold: 2 },
    { tier: "Silver", threshold: 16 },
    { tier: "Gold", threshold: 128 },
  ];

  it("returns 0% and Bronze when current = 0", () => {
    const { nextMilestone, progressPercent } = computeMilestoneProgress(0, milestones);
    expect(nextMilestone?.tier).toBe("Bronze");
    expect(progressPercent).toBe(0);
  });

  it("returns 50% progress towards Bronze when current = 1", () => {
    const { nextMilestone, progressPercent } = computeMilestoneProgress(1, milestones);
    expect(nextMilestone?.tier).toBe("Bronze");
    expect(progressPercent).toBe(50);
  });

  it("advances to Silver once Bronze threshold is met (current = 2)", () => {
    const { nextMilestone } = computeMilestoneProgress(2, milestones);
    expect(nextMilestone?.tier).toBe("Silver");
  });

  it("calculates mid-Silver progress correctly (current = 9)", () => {
    // Bronze=2, Silver=16; range=14; position=9-2=7 -> 50%
    const { nextMilestone, progressPercent } = computeMilestoneProgress(9, milestones);
    expect(nextMilestone?.tier).toBe("Silver");
    expect(progressPercent).toBe(50);
  });

  it("advances to Gold once Silver threshold is met (current = 16)", () => {
    const { nextMilestone } = computeMilestoneProgress(16, milestones);
    expect(nextMilestone?.tier).toBe("Gold");
  });

  it("returns no nextMilestone and 100% when all tiers surpassed (current = 128)", () => {
    const { nextMilestone, progressPercent } = computeMilestoneProgress(128, milestones);
    expect(nextMilestone).toBeUndefined();
    expect(progressPercent).toBe(100);
  });

  it("clamps progressPercent to 100 even when current greatly exceeds threshold", () => {
    const { progressPercent } = computeMilestoneProgress(9999, milestones);
    expect(progressPercent).toBe(100);
  });

  it("returns 100% and no nextMilestone for empty milestones array", () => {
    const { nextMilestone, progressPercent } = computeMilestoneProgress(0, []);
    expect(nextMilestone).toBeUndefined();
    expect(progressPercent).toBe(100);
  });

  it("does not return negative progressPercent for negative input", () => {
    const { progressPercent } = computeMilestoneProgress(-5, milestones);
    expect(progressPercent).toBeGreaterThanOrEqual(0);
  });
});

// --- estimatePullSharkProgress -----------------------------------------------

describe("estimatePullSharkProgress", () => {
  it("has slug 'pull-shark' and dataAvailable: true", () => {
    const result = estimatePullSharkProgress(0);
    expect(result.slug).toBe("pull-shark");
    expect(result.dataAvailable).toBe(true);
  });

  it("reflects currentValue in output", () => {
    expect(estimatePullSharkProgress(7).currentValue).toBe(7);
  });

  it("targets Bronze milestone when mergedPRs < 2", () => {
    const result = estimatePullSharkProgress(1);
    expect(result.nextMilestone?.tier).toBe("Bronze");
    expect(result.nextMilestone?.threshold).toBe(2);
  });

  it("targets Silver milestone when mergedPRs = 2", () => {
    expect(estimatePullSharkProgress(2).nextMilestone?.tier).toBe("Silver");
  });

  it("targets Gold milestone when mergedPRs = 16", () => {
    expect(estimatePullSharkProgress(16).nextMilestone?.tier).toBe("Gold");
  });

  it("returns no nextMilestone when all tiers reached (mergedPRs = 128)", () => {
    expect(estimatePullSharkProgress(128).nextMilestone).toBeUndefined();
  });

  it("progressDescription mentions merged PRs and next threshold (Bronze)", () => {
    const result = estimatePullSharkProgress(1);
    expect(result.progressDescription).toMatch(/1/);
    expect(result.progressDescription).toMatch(/2/);
    expect(result.progressDescription).toMatch(/merged PR/i);
  });

  it("progressDescription says 'all tiers reached' when Gold surpassed", () => {
    const result = estimatePullSharkProgress(200);
    expect(result.progressDescription).toMatch(/all tiers reached/i);
  });

  it("progressPercent is between 0 and 100 for all sample values", () => {
    [0, 1, 2, 8, 16, 64, 128, 200].forEach((n) => {
      const { progressPercent } = estimatePullSharkProgress(n);
      expect(progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressPercent).toBeLessThanOrEqual(100);
    });
  });
});

// --- estimateGalaxyBrainProgress ---------------------------------------------

describe("estimateGalaxyBrainProgress", () => {
  it("has slug 'galaxy-brain' and dataAvailable: true", () => {
    const result = estimateGalaxyBrainProgress(0);
    expect(result.slug).toBe("galaxy-brain");
    expect(result.dataAvailable).toBe(true);
  });

  it("reflects currentValue in output", () => {
    expect(estimateGalaxyBrainProgress(5).currentValue).toBe(5);
  });

  it("targets Bronze milestone when acceptedAnswers < 2", () => {
    const result = estimateGalaxyBrainProgress(1);
    expect(result.nextMilestone?.tier).toBe("Bronze");
    expect(result.nextMilestone?.threshold).toBe(2);
  });

  it("targets Silver milestone when acceptedAnswers = 2", () => {
    const result = estimateGalaxyBrainProgress(2);
    expect(result.nextMilestone?.tier).toBe("Silver");
    expect(result.nextMilestone?.threshold).toBe(8);
  });

  it("targets Gold milestone when acceptedAnswers = 8", () => {
    const result = estimateGalaxyBrainProgress(8);
    expect(result.nextMilestone?.tier).toBe("Gold");
    expect(result.nextMilestone?.threshold).toBe(16);
  });

  it("returns no nextMilestone when Gold threshold reached (= 16)", () => {
    expect(estimateGalaxyBrainProgress(16).nextMilestone).toBeUndefined();
  });

  it("progressDescription mentions accepted answers and next threshold", () => {
    const result = estimateGalaxyBrainProgress(3);
    expect(result.progressDescription).toMatch(/3/);
    expect(result.progressDescription).toMatch(/8/);
    expect(result.progressDescription).toMatch(/accepted answer/i);
  });

  it("progressDescription says 'all tiers reached' beyond Gold", () => {
    expect(estimateGalaxyBrainProgress(20).progressDescription).toMatch(/all tiers reached/i);
  });

  it("progressPercent is between 0 and 100 for all sample values", () => {
    [0, 1, 2, 5, 8, 12, 16, 50].forEach((n) => {
      const { progressPercent } = estimateGalaxyBrainProgress(n);
      expect(progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressPercent).toBeLessThanOrEqual(100);
    });
  });
});

// --- getQuickdrawProgress ----------------------------------------------------

describe("getQuickdrawProgress", () => {
  it("has slug 'quickdraw'", () => {
    expect(getQuickdrawProgress().slug).toBe("quickdraw");
  });

  it("has title 'Quickdraw'", () => {
    expect(getQuickdrawProgress().title).toBe("Quickdraw");
  });

  it("has dataAvailable: false", () => {
    expect(getQuickdrawProgress().dataAvailable).toBe(false);
  });

  it("does not include currentValue", () => {
    expect(getQuickdrawProgress().currentValue).toBeUndefined();
  });

  it("does not include progressPercent", () => {
    expect(getQuickdrawProgress().progressPercent).toBeUndefined();
  });

  it("does not include nextMilestone", () => {
    expect(getQuickdrawProgress().nextMilestone).toBeUndefined();
  });
});

// --- getPairExtraordinaireProgress -------------------------------------------

describe("getPairExtraordinaireProgress", () => {
  it("has slug 'pair-extraordinaire'", () => {
    expect(getPairExtraordinaireProgress().slug).toBe("pair-extraordinaire");
  });

  it("has title 'Pair Extraordinaire'", () => {
    expect(getPairExtraordinaireProgress().title).toBe("Pair Extraordinaire");
  });

  it("has dataAvailable: false", () => {
    expect(getPairExtraordinaireProgress().dataAvailable).toBe(false);
  });

  it("does not include currentValue", () => {
    expect(getPairExtraordinaireProgress().currentValue).toBeUndefined();
  });

  it("does not include progressPercent", () => {
    expect(getPairExtraordinaireProgress().progressPercent).toBeUndefined();
  });
});

// --- buildLockedAchievementProgress ------------------------------------------

describe("buildLockedAchievementProgress", () => {
  const data = { mergedPRs: 5, acceptedAnswers: 3 };

  it("returns all four achievements when unlockedSlugs is empty", () => {
    const results = buildLockedAchievementProgress(data, new Set());
    const slugs = results.map((r) => r.slug);
    expect(slugs).toContain("pull-shark");
    expect(slugs).toContain("galaxy-brain");
    expect(slugs).toContain("quickdraw");
    expect(slugs).toContain("pair-extraordinaire");
  });

  it("omits pull-shark when it is in unlockedSlugs", () => {
    const results = buildLockedAchievementProgress(data, new Set(["pull-shark"]));
    expect(results.some((r) => r.slug === "pull-shark")).toBe(false);
    expect(results.some((r) => r.slug === "galaxy-brain")).toBe(true);
  });

  it("omits galaxy-brain when it is in unlockedSlugs", () => {
    const results = buildLockedAchievementProgress(data, new Set(["galaxy-brain"]));
    expect(results.some((r) => r.slug === "galaxy-brain")).toBe(false);
    expect(results.some((r) => r.slug === "pull-shark")).toBe(true);
  });

  it("omits both estimable achievements when both are unlocked", () => {
    const results = buildLockedAchievementProgress(
      data,
      new Set(["pull-shark", "galaxy-brain"])
    );
    expect(results.some((r) => r.slug === "pull-shark")).toBe(false);
    expect(results.some((r) => r.slug === "galaxy-brain")).toBe(false);
    expect(results.some((r) => r.slug === "quickdraw")).toBe(true);
  });

  it("returns an empty array when all four slugs are unlocked", () => {
    const results = buildLockedAchievementProgress(
      data,
      new Set(["pull-shark", "galaxy-brain", "quickdraw", "pair-extraordinaire"])
    );
    expect(results).toHaveLength(0);
  });

  it("uses null-data stub for pull-shark when data is null", () => {
    const results = buildLockedAchievementProgress(null, new Set());
    const pullShark = results.find((r) => r.slug === "pull-shark");
    expect(pullShark?.dataAvailable).toBe(false);
  });

  it("uses null-data stub for galaxy-brain when data is null", () => {
    const results = buildLockedAchievementProgress(null, new Set());
    const galaxyBrain = results.find((r) => r.slug === "galaxy-brain");
    expect(galaxyBrain?.dataAvailable).toBe(false);
  });

  it("keeps quickdraw and pair-extraordinaire stubs intact when data is null", () => {
    const results = buildLockedAchievementProgress(null, new Set());
    expect(results.some((r) => r.slug === "quickdraw" && !r.dataAvailable)).toBe(true);
    expect(
      results.some((r) => r.slug === "pair-extraordinaire" && !r.dataAvailable)
    ).toBe(true);
  });

  it("passes metrics through to estimatePullSharkProgress when data is present", () => {
    const results = buildLockedAchievementProgress(
      { mergedPRs: 20, acceptedAnswers: 0 },
      new Set()
    );
    const pullShark = results.find((r) => r.slug === "pull-shark");
    expect(pullShark?.currentValue).toBe(20);
    expect(pullShark?.nextMilestone?.tier).toBe("Gold");
  });

  it("passes metrics through to estimateGalaxyBrainProgress when data is present", () => {
    const results = buildLockedAchievementProgress(
      { mergedPRs: 0, acceptedAnswers: 10 },
      new Set()
    );
    const galaxyBrain = results.find((r) => r.slug === "galaxy-brain");
    expect(galaxyBrain?.currentValue).toBe(10);
    expect(galaxyBrain?.nextMilestone?.tier).toBe("Gold");
  });
});
