import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateStreakFromDates,
  calculateCurrentStreak as currentStreakFromSet,
  calculateStreak,
} from "@/lib/streak";
import {
  calculateCurrentStreak,
  calculateLongestStreak,
} from "@/lib/streak-utils";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function days(...dates: string[]): Set<string> {
  return new Set(dates);
}

// ──────────────────────────────────────────────────────────────────────────────
// calculateStreakFromDates  (src/lib/streak.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe("calculateStreakFromDates", () => {
  // Fake clock: 2026-06-15 12:00 UTC
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 0 for empty commit history", () => {
    const result = calculateStreakFromDates(new Set(), new Set());
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.totalActiveDays).toBe(0);
    expect(result.lastCommitDate).toBeNull();
    expect(result.freezeDates).toEqual([]);
  });

  it("returns 1 for a single active date today", () => {
    const result = calculateStreakFromDates(days("2026-06-15"));
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.lastCommitDate).toBe("2026-06-15");
  });

  it("returns 1 for a single active date yesterday", () => {
    const result = calculateStreakFromDates(days("2026-06-14"));
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
  });

  it("returns 0 when the most recent date is older than yesterday", () => {
    const result = calculateStreakFromDates(days("2026-06-12", "2026-06-13"));
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it("counts consecutive days correctly", () => {
    const result = calculateStreakFromDates(
      days("2026-06-13", "2026-06-14", "2026-06-15")
    );
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });

  it("resets current streak on a missed day", () => {
    // run1: 06-10→06-12 (3 days), run2: 06-14→06-15 (2 days, ending today)
    const result = calculateStreakFromDates(
      days("2026-06-10", "2026-06-11", "2026-06-12", "2026-06-14", "2026-06-15")
    );
    expect(result.current).toBe(2);
    expect(result.longest).toBe(3);
  });

  it("handles streak freeze: freeze date bridges a one-day gap", () => {
    const activeDates = days("2026-06-13", "2026-06-15");
    const freezeDates = days("2026-06-14");
    const result = calculateStreakFromDates(activeDates, freezeDates);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
    expect(result.freezeDates).toContain("2026-06-14");
  });

  it("handles streak freeze with only freeze dates and no active commits", () => {
    const result = calculateStreakFromDates(
      new Set(),
      days("2026-06-14", "2026-06-15")
    );
    expect(result.current).toBe(2);
    expect(result.longest).toBe(2);
    expect(result.totalActiveDays).toBe(2);
  });

  it("calculates longest streak from history spanning multiple runs", () => {
    // run1: 5 days; run2: 2 days (06-13→06-14, ending yesterday)
    const result = calculateStreakFromDates(
      days(
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-04",
        "2026-06-05",
        "2026-06-13",
        "2026-06-14"
      )
    );
    expect(result.longest).toBe(5);
    expect(result.current).toBe(2);
  });

  // ── Streak-at-risk detection ────────────────────────────────────────────────
  // "At risk" = streak is alive (current > 0) but the last commit was yesterday,
  // not today, so the streak will expire if no commit is made before midnight.

  it("detects streak at risk: last commit yesterday, no commit today", () => {
    const result = calculateStreakFromDates(days("2026-06-13", "2026-06-14"));
    // Streak is alive via the grace-period (yesterday counts)
    expect(result.current).toBe(2);
    // The last commit is yesterday, not today → at risk
    expect(result.lastCommitDate).toBe("2026-06-14");
    const isAtRisk =
      result.current > 0 && result.lastCommitDate !== "2026-06-15";
    expect(isAtRisk).toBe(true);
  });

  it("is not at risk when a commit exists today", () => {
    const result = calculateStreakFromDates(days("2026-06-14", "2026-06-15"));
    expect(result.current).toBe(2);
    const isAtRisk =
      result.current > 0 && result.lastCommitDate !== "2026-06-15";
    expect(isAtRisk).toBe(false);
  });

  // ── Timezone boundaries ─────────────────────────────────────────────────────

  it("handles timezone boundaries: same wall-clock moment is different calendar dates across zones", () => {
    // 2026-06-16 02:00 UTC = 2026-06-15 22:00 America/New_York (UTC-4)
    vi.setSystemTime(new Date("2026-06-16T02:00:00Z"));
    const activeDates = days("2026-06-13", "2026-06-14");

    // UTC: today=2026-06-16, yesterday=2026-06-15 → last date 06-14 < yesterday → expired
    const utcResult = calculateStreakFromDates(activeDates, new Set(), "UTC");
    expect(utcResult.current).toBe(0);

    // NY: today=2026-06-15, yesterday=2026-06-14 → last date 06-14 = yesterday → alive
    const nyResult = calculateStreakFromDates(
      activeDates,
      new Set(),
      "America/New_York"
    );
    expect(nyResult.current).toBe(2);
  });

  it("correctly identifies today in a UTC+12 timezone (far ahead of UTC)", () => {
    // 2026-06-15 20:00 UTC = 2026-06-16 08:00 in Pacific/Auckland (UTC+12)
    vi.setSystemTime(new Date("2026-06-15T20:00:00Z"));
    const activeDates = days("2026-06-15", "2026-06-16");

    // Auckland: today=2026-06-16 → last date 06-16 = today → alive
    const nzResult = calculateStreakFromDates(
      activeDates,
      new Set(),
      "Pacific/Auckland"
    );
    expect(nzResult.current).toBe(2);

    // UTC: today=2026-06-15, yesterday=2026-06-14 → last date 06-16 > today → current=0
    // (future date can't be "today or yesterday")
    const utcResult = calculateStreakFromDates(activeDates, new Set(), "UTC");
    expect(utcResult.current).toBe(0);
  });

  // ── Shortly-after-midnight ──────────────────────────────────────────────────

  it("counts today correctly when a commit occurs shortly after UTC midnight", () => {
    vi.setSystemTime(new Date("2026-06-15T00:05:00Z"));
    const result = calculateStreakFromDates(days("2026-06-14", "2026-06-15"));
    expect(result.current).toBe(2);
    expect(result.lastCommitDate).toBe("2026-06-15");
  });

  // ── Leap year ───────────────────────────────────────────────────────────────

  it("handles leap year: Feb 28 → Feb 29 → Mar 1 are consecutive (2024)", () => {
    const result = calculateStreakFromDates(
      days("2024-02-28", "2024-02-29", "2024-03-01")
    );
    expect(result.longest).toBe(3);
  });

  it("treats Feb 28 → Mar 1 as consecutive in a non-leap year (28-day February)", () => {
    const result = calculateStreakFromDates(
      days("2025-02-28", "2025-03-01")
    );
    // Gap of 1 day: Feb has 28 days in 2025, so these ARE consecutive
    expect(result.longest).toBe(2);
  });

  // ── Month transitions ───────────────────────────────────────────────────────

  it("handles 28-day February to March transition (non-leap year)", () => {
    const result = calculateStreakFromDates(
      days("2025-02-27", "2025-02-28", "2025-03-01")
    );
    expect(result.longest).toBe(3);
  });

  it("handles 29-day February to March transition (leap year)", () => {
    const result = calculateStreakFromDates(
      days("2024-02-29", "2024-03-01")
    );
    expect(result.longest).toBe(2);
  });

  it("handles 30-day month transition: April 30 → May 1", () => {
    const result = calculateStreakFromDates(
      days("2026-04-29", "2026-04-30", "2026-05-01")
    );
    expect(result.longest).toBe(3);
  });

  it("handles 31-day month transition: January 31 → February 1", () => {
    const result = calculateStreakFromDates(
      days("2026-01-30", "2026-01-31", "2026-02-01")
    );
    expect(result.longest).toBe(3);
  });

  it("handles year boundary: December 31 → January 1", () => {
    const result = calculateStreakFromDates(
      days("2025-12-30", "2025-12-31", "2026-01-01")
    );
    expect(result.longest).toBe(3);
  });

  // ── Edge cases: overlap and deduplication ───────────────────────────────────

  it("does not double-count dates that appear in both active and freeze sets", () => {
    // active: 06-13, 06-14; freeze: 06-14, 06-15 → combined unique: 3 days
    const result = calculateStreakFromDates(
      days("2026-06-13", "2026-06-14"),
      days("2026-06-14", "2026-06-15")
    );
    expect(result.totalActiveDays).toBe(3);
    expect(result.current).toBe(3);
  });

  it("reports lastCommitDate as the chronologically latest date across active and freeze", () => {
    const result = calculateStreakFromDates(
      days("2026-06-13"),
      days("2026-06-15")
    );
    expect(result.lastCommitDate).toBe("2026-06-15");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// calculateCurrentStreak — Set/string[] wrapper  (src/lib/streak.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe("calculateCurrentStreak — Set/string[] wrapper (streak.ts)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 0 for an empty Set", () => {
    expect(currentStreakFromSet(new Set())).toBe(0);
  });

  it("returns 0 for an empty array", () => {
    expect(currentStreakFromSet([])).toBe(0);
  });

  it("accepts a Set<string> of YYYY-MM-DD dates", () => {
    expect(currentStreakFromSet(new Set(["2026-06-14", "2026-06-15"]))).toBe(2);
  });

  it("accepts a string[] and slices full ISO timestamps to the date part", () => {
    expect(
      currentStreakFromSet(["2026-06-14T10:00:00Z", "2026-06-15T08:30:00Z"])
    ).toBe(2);
  });

  it("returns 0 when the latest date is older than yesterday", () => {
    expect(
      currentStreakFromSet(["2026-06-10", "2026-06-11", "2026-06-12"])
    ).toBe(0);
  });

  it("handles a single YYYY-MM-DD string matching today", () => {
    expect(currentStreakFromSet(["2026-06-15"])).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// calculateStreak — Date[] adapter  (src/lib/streak.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe("calculateStreak — Date[] adapter (streak.ts)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 0/0 for empty input", () => {
    expect(calculateStreak([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it("computes current and longest streak from Date objects", () => {
    const result = calculateStreak([
      new Date("2026-06-13T10:00:00Z"),
      new Date("2026-06-14T10:00:00Z"),
      new Date("2026-06-15T10:00:00Z"),
    ]);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it("deduplicates multiple commits on the same UTC day", () => {
    const result = calculateStreak([
      new Date("2026-06-14T00:01:00Z"),
      new Date("2026-06-14T23:59:00Z"),
      new Date("2026-06-15T10:00:00Z"),
    ]);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it("reports only the latest consecutive run as the current streak", () => {
    const result = calculateStreak([
      new Date("2026-06-10T10:00:00Z"),
      new Date("2026-06-14T10:00:00Z"),
      new Date("2026-06-15T10:00:00Z"),
    ]);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it("computes the all-time longest streak regardless of recency", () => {
    const result = calculateStreak([
      new Date("2026-01-01T10:00:00Z"),
      new Date("2026-01-02T10:00:00Z"),
      new Date("2026-01-03T10:00:00Z"),
      new Date("2026-01-04T10:00:00Z"),
      new Date("2026-06-14T10:00:00Z"),
      new Date("2026-06-15T10:00:00Z"),
    ]);
    expect(result.longestStreak).toBe(4);
    expect(result.currentStreak).toBe(2);
  });

  it("counts today correctly when a commit arrives just after UTC midnight", () => {
    vi.setSystemTime(new Date("2026-06-15T00:10:00Z"));
    const result = calculateStreak([
      new Date("2026-06-14T10:00:00Z"),
      new Date("2026-06-15T00:02:00Z"),
    ]);
    expect(result.currentStreak).toBe(2);
  });

  it("handles leap year Feb 29 as a UTC day in a consecutive run", () => {
    const result = calculateStreak([
      new Date("2024-02-28T12:00:00Z"),
      new Date("2024-02-29T12:00:00Z"),
      new Date("2024-03-01T12:00:00Z"),
    ]);
    expect(result.longestStreak).toBe(3);
  });

  it("handles year boundary December 31 → January 1", () => {
    const result = calculateStreak([
      new Date("2025-12-30T12:00:00Z"),
      new Date("2025-12-31T12:00:00Z"),
      new Date("2026-01-01T12:00:00Z"),
    ]);
    expect(result.longestStreak).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// calculateCurrentStreak  (src/lib/streak-utils.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe("calculateCurrentStreak (streak-utils.ts)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 0 for empty commit history", () => {
    expect(calculateCurrentStreak([])).toBe(0);
  });

  it("returns 1 for a single commit today", () => {
    expect(calculateCurrentStreak(["2026-06-15"])).toBe(1);
  });

  it("returns 1 for a single commit yesterday", () => {
    expect(calculateCurrentStreak(["2026-06-14"])).toBe(1);
  });

  it("returns 0 when the latest commit is older than yesterday", () => {
    expect(calculateCurrentStreak(["2026-06-13"])).toBe(0);
  });

  it("counts consecutive days correctly ending today", () => {
    expect(
      calculateCurrentStreak(["2026-06-13", "2026-06-14", "2026-06-15"])
    ).toBe(3);
  });

  it("counts consecutive days correctly ending yesterday", () => {
    expect(
      calculateCurrentStreak(["2026-06-12", "2026-06-13", "2026-06-14"])
    ).toBe(3);
  });

  it("resets streak on a missed day, returning only the latest consecutive run", () => {
    expect(
      calculateCurrentStreak([
        "2026-06-10",
        "2026-06-11",
        "2026-06-13",
        "2026-06-14",
        "2026-06-15",
      ])
    ).toBe(3);
  });

  it("deduplicates multiple commits on the same day", () => {
    expect(
      calculateCurrentStreak(["2026-06-14", "2026-06-14", "2026-06-15"])
    ).toBe(2);
  });

  it("handles unsorted input", () => {
    expect(
      calculateCurrentStreak(["2026-06-15", "2026-06-13", "2026-06-14"])
    ).toBe(3);
  });

  it("accepts Date objects as input", () => {
    expect(
      calculateCurrentStreak([
        new Date("2026-06-13T10:00:00Z"),
        new Date("2026-06-14T10:00:00Z"),
        new Date("2026-06-15T10:00:00Z"),
      ])
    ).toBe(3);
  });

  it("detects streak at risk: last commit is yesterday, no commit today", () => {
    const streak = calculateCurrentStreak(["2026-06-13", "2026-06-14"]);
    // Streak is alive via the one-day grace period
    expect(streak).toBe(2);
    // Caller infers at-risk by comparing lastCommitDate to today independently
  });

  it("counts today correctly when a commit occurs shortly after UTC midnight", () => {
    vi.setSystemTime(new Date("2026-06-15T00:05:00Z"));
    expect(calculateCurrentStreak(["2026-06-14", "2026-06-15"])).toBe(2);
  });

  it("handles year boundary: December 31 → January 1", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    expect(calculateCurrentStreak(["2025-12-31", "2026-01-01"])).toBe(2);
  });

  it("handles leap year Feb 29 in a consecutive run", () => {
    vi.setSystemTime(new Date("2024-03-01T12:00:00Z"));
    expect(
      calculateCurrentStreak(["2024-02-28", "2024-02-29", "2024-03-01"])
    ).toBe(3);
  });

  it("handles 28-day February to March transition (non-leap year 2025)", () => {
    vi.setSystemTime(new Date("2025-03-01T12:00:00Z"));
    expect(
      calculateCurrentStreak(["2025-02-27", "2025-02-28", "2025-03-01"])
    ).toBe(3);
  });

  it("handles 30-day month transition: April 30 → May 1", () => {
    vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
    expect(
      calculateCurrentStreak(["2026-04-29", "2026-04-30", "2026-05-01"])
    ).toBe(3);
  });

  it("handles 31-day month transition: January 31 → February 1", () => {
    vi.setSystemTime(new Date("2026-02-01T12:00:00Z"));
    expect(
      calculateCurrentStreak(["2026-01-30", "2026-01-31", "2026-02-01"])
    ).toBe(3);
  });

  it("filters out invalid date strings silently", () => {
    expect(calculateCurrentStreak(["not-a-date", "2026-06-15"])).toBe(1);
  });

  it("filters out invalid Date objects (NaN) silently", () => {
    expect(
      calculateCurrentStreak([
        new Date("invalid"),
        new Date("2026-06-15T10:00:00Z"),
      ])
    ).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// calculateLongestStreak  (src/lib/streak-utils.ts)
// ──────────────────────────────────────────────────────────────────────────────

describe("calculateLongestStreak (streak-utils.ts)", () => {
  it("returns 0 for empty input", () => {
    expect(calculateLongestStreak([])).toBe(0);
  });

  it("returns 1 for a single active day", () => {
    expect(calculateLongestStreak(["2026-06-15"])).toBe(1);
  });

  it("finds the all-time longest streak across gaps", () => {
    expect(
      calculateLongestStreak([
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-04",
        "2026-06-10",
        "2026-06-11",
      ])
    ).toBe(4);
  });

  it("deduplicates dates before calculating", () => {
    expect(
      calculateLongestStreak(["2026-06-01", "2026-06-01", "2026-06-02"])
    ).toBe(2);
  });

  it("handles unsorted input correctly", () => {
    expect(
      calculateLongestStreak([
        "2026-06-05",
        "2026-06-01",
        "2026-06-03",
        "2026-06-02",
        "2026-06-04",
      ])
    ).toBe(5);
  });

  it("correctly picks the longer of two disjoint runs", () => {
    expect(
      calculateLongestStreak([
        "2026-01-01",
        "2026-01-02",
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-04",
        "2026-06-05",
      ])
    ).toBe(5);
  });

  it("handles year boundary: December 31 → January 1 as consecutive", () => {
    expect(
      calculateLongestStreak(["2025-12-30", "2025-12-31", "2026-01-01"])
    ).toBe(3);
  });

  it("handles leap year: Feb 29 as a consecutive day", () => {
    expect(
      calculateLongestStreak(["2024-02-28", "2024-02-29", "2024-03-01"])
    ).toBe(3);
  });

  it("handles 28-day February to March transition (non-leap year 2025)", () => {
    expect(
      calculateLongestStreak(["2025-02-27", "2025-02-28", "2025-03-01"])
    ).toBe(3);
  });

  it("handles 30-day month transition: April 30 → May 1", () => {
    expect(
      calculateLongestStreak(["2026-04-29", "2026-04-30", "2026-05-01"])
    ).toBe(3);
  });

  it("handles 31-day month transition: January 31 → February 1", () => {
    expect(
      calculateLongestStreak(["2026-01-30", "2026-01-31", "2026-02-01"])
    ).toBe(3);
  });

  it("accepts Date objects", () => {
    expect(
      calculateLongestStreak([
        new Date("2026-06-01T10:00:00Z"),
        new Date("2026-06-02T10:00:00Z"),
        new Date("2026-06-03T10:00:00Z"),
      ])
    ).toBe(3);
  });
});
