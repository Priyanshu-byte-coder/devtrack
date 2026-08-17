import { describe, it, expect } from "vitest";
import { evaluateBadges } from "./badge-evaluator";

describe("evaluateBadges", () => {
  it("unlocks 7-day-streak when currentStreak >= 7", () => {
    const statuses = evaluateBadges({ currentStreak: 7, mergedPRs: 0, completedGoals: 0 }, false);
    const streakBadge = statuses.find((b) => b.id === "7-day-streak");
    expect(streakBadge?.isUnlocked).toBe(true);
    expect(streakBadge?.progress?.current).toBe(7);
  });

  it("locks 7-day-streak when currentStreak < 7", () => {
    const statuses = evaluateBadges({ currentStreak: 6, mergedPRs: 0, completedGoals: 0 }, false);
    const streakBadge = statuses.find((b) => b.id === "7-day-streak");
    expect(streakBadge?.isUnlocked).toBe(false);
    expect(streakBadge?.progress?.current).toBe(6);
  });

  it("unlocks 10-prs-merged when mergedPRs >= 10", () => {
    const statuses = evaluateBadges({ currentStreak: 0, mergedPRs: 10, completedGoals: 0 }, false);
    const pr10 = statuses.find((b) => b.id === "10-prs-merged");
    const pr50 = statuses.find((b) => b.id === "50-prs-merged");
    
    expect(pr10?.isUnlocked).toBe(true);
    expect(pr50?.isUnlocked).toBe(false);
    expect(pr50?.progress?.current).toBe(10);
  });

  it("unlocks 50-prs-merged when mergedPRs >= 50", () => {
    const statuses = evaluateBadges({ currentStreak: 0, mergedPRs: 50, completedGoals: 0 }, false);
    const pr10 = statuses.find((b) => b.id === "10-prs-merged");
    const pr50 = statuses.find((b) => b.id === "50-prs-merged");
    
    expect(pr10?.isUnlocked).toBe(true);
    expect(pr50?.isUnlocked).toBe(true);
  });

  it("unlocks first-goal when completedGoals >= 1", () => {
    const statuses = evaluateBadges({ currentStreak: 0, mergedPRs: 0, completedGoals: 1 }, false);
    const firstGoal = statuses.find((b) => b.id === "first-goal");
    expect(firstGoal?.isUnlocked).toBe(true);
  });

  it("unlocks early-bird when hasEarlyBird is true", () => {
    const statuses = evaluateBadges({ currentStreak: 0, mergedPRs: 0, completedGoals: 0 }, true);
    const earlyBird = statuses.find((b) => b.id === "early-bird");
    expect(earlyBird?.isUnlocked).toBe(true);
  });

  it("preserves unlocked timestamp from previously unlocked badges", () => {
    const mockDate = new Date("2020-01-01T00:00:00Z").toISOString();
    const previouslyUnlocked = [{ id: "7-day-streak", unlockedAt: mockDate }];
    
    const statuses = evaluateBadges({ currentStreak: 2, mergedPRs: 0, completedGoals: 0 }, false, previouslyUnlocked);
    const streakBadge = statuses.find((b) => b.id === "7-day-streak");
    
    expect(streakBadge?.isUnlocked).toBe(true);
    expect(streakBadge?.unlockedAt).toBe(mockDate);
  });
});
