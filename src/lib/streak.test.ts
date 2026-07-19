import { describe, it, expect } from "vitest";
import { calculateStreak } from "./streak";

function utcDay(daysAgo: number): Date {
  return new Date(Date.UTC(2026, 4, 31 - daysAgo, 12, 0, 0));
}

describe("calculateStreak", () => {
  it("returns 0/0 for empty input", () => {
    expect(calculateStreak([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it("deduplicates multiple commits on the same UTC day", () => {
    const d1 = new Date(Date.UTC(2026, 4, 30, 1, 0, 0));
    const d2 = new Date(Date.UTC(2026, 4, 30, 23, 59, 0));
    expect(calculateStreak([d1, d2])).toEqual({ currentStreak: 0, longestStreak: 1 });
  });

  it("computes longest streak across gaps", () => {
    const result = calculateStreak([utcDay(10), utcDay(9), utcDay(8), utcDay(5), utcDay(1)]);
    expect(result.longestStreak).toBe(3);
  });

  it("returns current streak when last active day is today or yesterday (UTC)", () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    const { currentStreak: a } = calculateStreak([yesterday]);
    expect(a).toBe(1);

    const { currentStreak: b } = calculateStreak([today]);
    expect(b).toBe(1);
  });

  it("does not report current streak when the last active day is older than yesterday", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    const { currentStreak, longestStreak } = calculateStreak([twoDaysAgo]);
    expect(longestStreak).toBe(1);
    expect(currentStreak).toBe(0);
  });

  it("handles timezone boundary cases via UTC day bucketing", () => {
    const nearMidnight = new Date("2026-06-01T00:30:00+05:30"); // 2026-05-31 UTC
    const nextUtcDay = new Date("2026-06-01T23:30:00+05:30"); // 2026-06-01 UTC

    const { longestStreak } = calculateStreak([nearMidnight, nextUtcDay]);
    expect(longestStreak).toBe(2);
  });
});

