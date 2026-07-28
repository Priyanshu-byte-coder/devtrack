import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateStreakFromDates,
  calculateStreak,
} from "@/lib/streak";

describe("Commit Streak Calculator Unit Tests (src/lib/streak.ts)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("5 consecutive days → streak = 5", () => {
    const activeDates = new Set([
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
    ]);
    const result = calculateStreakFromDates(activeDates);
    expect(result.current).toBe(5);
    expect(result.longest).toBe(5);
    expect(result.totalActiveDays).toBe(5);
  });

  it("Gap of 1 day with a freeze token → streak continues", () => {
    const activeDates = new Set(["2026-06-13", "2026-06-15"]);
    const freezeDates = new Set(["2026-06-14"]);
    const result = calculateStreakFromDates(activeDates, freezeDates);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
    expect(result.freezeDates).toContain("2026-06-14");
  });

  it("Gap of 2 days with only 1 freeze → streak broken", () => {
    const activeDates = new Set(["2026-06-12", "2026-06-15"]);
    const freezeDates = new Set(["2026-06-13"]);
    const result = calculateStreakFromDates(activeDates, freezeDates);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(2);
  });

  it("Commits at 23:59 and 00:01 on adjacent days → counted as 2 days", () => {
    const commit1 = new Date("2026-06-14T23:59:00Z");
    const commit2 = new Date("2026-06-15T00:01:00Z");
    const result = calculateStreak([commit1, commit2]);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it("UTC commit at 23:30 = IST commit at 05:00 next day → timezone edge case", () => {
    const activeDates = new Set(["2026-06-14", "2026-06-15"]);
    const utcResult = calculateStreakFromDates(activeDates, new Set(), "UTC");
    expect(utcResult.current).toBe(2);

    const istResult = calculateStreakFromDates(activeDates, new Set(), "Asia/Kolkata");
    expect(istResult.current).toBe(2);
  });

  it("Multiple commits on same day → counts as 1 streak day", () => {
    const commit1 = new Date("2026-06-15T08:00:00Z");
    const commit2 = new Date("2026-06-15T14:30:00Z");
    const commit3 = new Date("2026-06-15T22:45:00Z");
    const result = calculateStreak([commit1, commit2, commit3]);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it("No commits today but committed yesterday → streak still active (day not over)", () => {
    const activeDates = new Set(["2026-06-14"]);
    const result = calculateStreakFromDates(activeDates);
    expect(result.current).toBe(1);
    expect(result.lastCommitDate).toBe("2026-06-14");
  });
});
