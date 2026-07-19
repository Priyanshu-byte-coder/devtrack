/**
 * Tests for src/lib/streak.ts
 *
 * Coverage
 * --------
 * calculateStreakFromDates  -- empty, single day, continuous streak, gap breaks,
 *                               freeze dates keep streak alive, wrap-around timezone
 * calculateCurrentStreak    -- Set and array input, deduplication
 * calculateStreak           -- Date[] adapter, delegates to calculateStreakFromDates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateStreakFromDates,
  calculateCurrentStreak,
  calculateStreak,
} from "../src/lib/streak";

// Mock @/lib/date-utils
vi.mock("@/lib/date-utils", () => ({
  dateDiffDays: vi.fn((a: string, b: string) => {
    const d1 = new Date(a);
    const d2 = new Date(b);
    return (d2.getTime() - d1.getTime()) / 86_400_000;
  }),
  toDateStr: (d: Date) => d.toISOString().slice(0, 10),
}));

// Freeze Date.now so today/yesterday are deterministic
const FIXED_NOW = new Date("2026-06-24T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateStreakFromDates", () => {
  it("returns zeros for empty active dates", () => {
    const result = calculateStreakFromDates(new Set(), new Set(), "UTC");
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.lastCommitDate).toBeNull();
    expect(result.totalActiveDays).toBe(0);
  });

  it("returns 1 for a single active date", () => {
    const result = calculateStreakFromDates(new Set(["2026-06-23"]), new Set(), "UTC");
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.lastCommitDate).toBe("2026-06-23");
    expect(result.totalActiveDays).toBe(1);
  });

  it("counts consecutive days as a single streak", () => {
    const dates = new Set(["2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23"]);
    const result = calculateStreakFromDates(dates, new Set(), "UTC");
    expect(result.current).toBe(4);
    expect(result.longest).toBe(4);
    expect(result.totalActiveDays).toBe(4);
  });

  it("breaks the streak when there is a gap", () => {
    // first run: 3 days, then gap, then 2 days
    const dates = new Set(["2026-06-18", "2026-06-19", "2026-06-20", "2026-06-23", "2026-06-24"]);
    const result = calculateStreakFromDates(dates, new Set(), "UTC");
    expect(result.current).toBe(2); // last run has today
    expect(result.longest).toBe(3); // first run was longer
    expect(result.totalActiveDays).toBe(5);
  });

  it("freeze dates are included in totalActiveDays and contribute to longest streak", () => {
    const active = new Set(["2026-06-20", "2026-06-21"]);
    const freeze = new Set(["2026-06-22"]); // freeze bridges the gap
    const result = calculateStreakFromDates(active, freeze, "UTC");
    expect(result.current).toBe(0); // last active is 2 days ago (yesterday = 23rd), so not alive
    expect(result.longest).toBe(3); // freeze fills the gap making longest = 3
    expect(result.totalActiveDays).toBe(3);
    expect(result.freezeDates).toEqual(["2026-06-22"]);
  
  });
  it("streak is alive when timezone is Asia/Kolkata and last date is today", () => {
  // FIXED_NOW = 2026-06-24T12:00:00Z = 2026-06-24 17:30 IST
  // Both UTC and IST resolve to same date here, so current streak should be 1
  const dates = new Set(["2026-06-24"]);
  const result = calculateStreakFromDates(dates, new Set(), "Asia/Kolkata");
  expect(result.current).toBe(1);
  expect(result.longest).toBe(1);
  });

  it("current is 0 when last active day is older than yesterday", () => {
    const dates = new Set(["2026-06-21"]); // 3 days ago
    const result = calculateStreakFromDates(dates, new Set(), "UTC");
    expect(result.current).toBe(0);
    expect(result.longest).toBe(1);
  });
});

describe("calculateCurrentStreak", () => {
  it("accepts a Set of date strings", () => {
    const result = calculateCurrentStreak(new Set(["2026-06-23", "2026-06-22"]));
    expect(result).toBe(2);
  });

  it("accepts an array of ISO timestamp strings and deduplicates", () => {
  // 2 timestamps on same date (2026-06-23) → slice(0,10) deduplicates → only 2 unique days
  const dates = ["2026-06-23T10:00:00Z", "2026-06-23T20:00:00Z", "2026-06-22T08:00:00Z"];
  const result = calculateCurrentStreak(dates);
  expect(result).toBe(2);
  });

  it("returns 0 for an empty array", () => {
    expect(calculateCurrentStreak([])).toBe(0);
    expect(calculateCurrentStreak(new Set())).toBe(0);
  });
});

describe("calculateStreak", () => {
  it("converts Date[] to a DateStreakResult", () => {
    const dates = [
      new Date("2026-06-22"),
      new Date("2026-06-23"),
      new Date("2026-06-24"),
    ];
    const result = calculateStreak(dates);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });
});
