import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getYearRange,
  calculateLongestStreak,
  getMostProductiveMonth,
  getMostContributedRepo,
  getPeakCodingHour,
  calculateLanguagePercentages,
  calculatePersonality,
} from "@/lib/wrapped";
import { calculateStreak } from "@/lib/streak";

vi.mock("@/lib/streak", () => ({
  calculateStreak: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wrapped", () => {
  describe("getYearRange", () => {
    it("returns full year range for a year in the past", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = getYearRange(2024, now);
      expect(result.startDate).toBe("2024-01-01");
      expect(result.endDate).toBe("2024-12-31");
      expect(result.partial).toBe(false);
    });

    it("returns partial range for current year", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = getYearRange(2025, now);
      expect(result.startDate).toBe("2025-01-01");
      expect(result.endDate).toBe("2025-06-15");
      expect(result.partial).toBe(true);
    });

    it("returns non-partial for future year when now is past year end", () => {
      const now = new Date("2026-01-15T12:00:00Z");
      const result = getYearRange(2025, now);
      expect(result.endDate).toBe("2025-12-31");
      expect(result.partial).toBe(false);
    });

    it("handles leap year boundaries", () => {
      const now = new Date("2026-01-15T12:00:00Z");
      const result = getYearRange(2024, now);
      expect(result.startDate).toBe("2024-01-01");
      expect(result.endDate).toBe("2024-12-31");
    });

    it("returns start and end as Date objects", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const result = getYearRange(2024, now);
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });
  });

  describe("calculateLongestStreak", () => {
    it("returns 0 for empty contributions map", () => {
      vi.mocked(calculateStreak).mockReturnValue({ currentStreak: 0, longestStreak: 0 });
      expect(calculateLongestStreak({})).toBe(0);
    });

    it("returns streak from calculateStreak for single active day", () => {
      vi.mocked(calculateStreak).mockReturnValue({ currentStreak: 1, longestStreak: 1 });
      expect(calculateLongestStreak({ "2024-01-15": 5 })).toBe(1);
    });

    it("returns longest streak for multiple days", () => {
      vi.mocked(calculateStreak).mockReturnValue({ currentStreak: 10, longestStreak: 30 });
      expect(calculateLongestStreak({ "2024-01-15": 3, "2024-02-10": 5 })).toBe(30);
    });

    it("filters out dates with zero contributions", () => {
      vi.mocked(calculateStreak).mockReturnValue({ currentStreak: 1, longestStreak: 1 });
      calculateLongestStreak({ "2024-01-15": 0, "2024-01-16": 5 });
      const calledDates = vi.mocked(calculateStreak).mock.calls[0][0];
      expect(calledDates.map((d: Date) => d.toISOString().slice(0, 10))).not.toContain("2024-01-15");
    });
  });

  describe("getMostProductiveMonth", () => {
    it("returns correct month for uniform contributions", () => {
      const contributions: Record<string, number> = {};
      for (let m = 0; m < 12; m++) {
        const month = String(m + 1).padStart(2, "0");
        contributions[`2024-${month}-15`] = 10;
      }
      // All equal — first month (January) wins
      const result = getMostProductiveMonth(contributions);
      expect(result.name).toBe("January");
      expect(result.commits).toBe(10);
    });

    it("returns the month with highest commits", () => {
      const contributions: Record<string, number> = {
        "2024-01-10": 1,
        "2024-02-10": 2,
        "2024-03-10": 50,
        "2024-04-10": 3,
      };
      const result = getMostProductiveMonth(contributions);
      expect(result.name).toBe("March");
      expect(result.commits).toBe(50);
    });

    it("ignores dates outside valid month range", () => {
      const contributions: Record<string, number> = {
        "2024-00-10": 100,
        "2024-13-10": 200,
        "2024-06-15": 5,
      };
      const result = getMostProductiveMonth(contributions);
      // Invalid months are ignored, so June wins
      expect(result.name).toBe("June");
      expect(result.commits).toBe(5);
    });

    it("handles empty contributions map", () => {
      const result = getMostProductiveMonth({});
      expect(result.name).toBe("January");
      expect(result.commits).toBe(0);
    });
  });

  describe("getMostContributedRepo", () => {
    it("returns No repository data for empty commits array", () => {
      const result = getMostContributedRepo([]);
      expect(result.name).toBe("No repository data");
      expect(result.commits).toBe(0);
    });

    it("returns correct repo for single repo", () => {
      const result = getMostContributedRepo([
        { date: "2024-01-01", repo: "my-repo" },
        { date: "2024-01-02", repo: "my-repo" },
      ]);
      expect(result.name).toBe("my-repo");
      expect(result.commits).toBe(2);
    });

    it("returns repo with highest commit count", () => {
      const result = getMostContributedRepo([
        { date: "2024-01-01", repo: "repo-a" },
        { date: "2024-01-02", repo: "repo-b" },
        { date: "2024-01-03", repo: "repo-b" },
        { date: "2024-01-04", repo: "repo-a" },
        { date: "2024-01-05", repo: "repo-b" },
      ]);
      expect(result.name).toBe("repo-b");
      expect(result.commits).toBe(3);
    });
  });

  describe("getPeakCodingHour", () => {
    it("returns Not enough data yet for empty hours array", () => {
      const result = getPeakCodingHour([]);
      expect(result.hour).toBeNull();
      expect(result.label).toBe("Not enough data yet");
      expect(result.commits).toBe(0);
    });

    it("returns correct hour for single hour", () => {
      const result = getPeakCodingHour([14]);
      expect(result.hour).toBe(14);
      expect(result.label).toBe("2pm");
      expect(result.commits).toBe(1);
    });

    it("ignores invalid hours (out of range)", () => {
      const result = getPeakCodingHour([25, -1, 14]);
      expect(result.hour).toBe(14);
    });

    it("ignores non-integer hours", () => {
      const result = getPeakCodingHour([3.5, 14]);
      expect(result.hour).toBe(14);
    });

    it("resolves ties by lower hour index", () => {
      const result = getPeakCodingHour([10, 14, 10, 14]);
      // Both 10 and 14 have 2 commits — lower index (10) wins
      expect(result.hour).toBe(10);
    });

    it("formats 12am correctly", () => {
      const result = getPeakCodingHour([0]);
      expect(result.label).toBe("12am");
    });

    it("formats 12pm correctly", () => {
      const result = getPeakCodingHour([12]);
      expect(result.label).toBe("12pm");
    });

    it("formats hours correctly", () => {
      expect(getPeakCodingHour([1]).label).toBe("1am");
      expect(getPeakCodingHour([11]).label).toBe("11am");
      expect(getPeakCodingHour([13]).label).toBe("1pm");
      expect(getPeakCodingHour([23]).label).toBe("11pm");
    });
  });

  describe("calculateLanguagePercentages", () => {
    it("handles empty totals", () => {
      const result = calculateLanguagePercentages({});
      expect(result).toEqual([]);
    });

    it("returns single language with 100%", () => {
      const result = calculateLanguagePercentages({ TypeScript: 5000 });
      expect(result).toEqual([{ name: "TypeScript", bytes: 5000, percentage: 100 }]);
    });

    it("sorts by bytes descending", () => {
      const result = calculateLanguagePercentages({
        Python: 100,
        TypeScript: 500,
        Rust: 300,
      });
      expect(result.map((l) => l.name)).toEqual(["TypeScript", "Rust", "Python"]);
    });

    it("respects limit parameter", () => {
      const result = calculateLanguagePercentages(
        { TypeScript: 500, Python: 300, Rust: 200, Go: 100 },
        2
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("TypeScript");
      expect(result[1].name).toBe("Python");
    });

    it("returns 0 percentage for zero total bytes", () => {
      const result = calculateLanguagePercentages({ TypeScript: 0 });
      expect(result[0].percentage).toBe(0);
    });

    it("calculates percentages correctly", () => {
      const result = calculateLanguagePercentages({
        TypeScript: 600,
        Python: 400,
      });
      // 600/1000 = 60%, 400/1000 = 40%
      expect(result[0].percentage).toBe(60);
      expect(result[1].percentage).toBe(40);
    });
  });

  describe("calculatePersonality", () => {
    it("returns Weekend Warrior when >40% commits are on weekends", () => {
      const contributions: Record<string, number> = {};
      // Set up enough weekend days with high counts
      for (let i = 0; i < 10; i++) {
        // 10 Saturdays
        contributions[`2024-06-${String(1 + i * 7).padStart(2, "0")}`] = 10;
        // 10 Sundays
        contributions[`2024-06-${String(2 + i * 7).padStart(2, "0")}`] = 10;
      }
      // Add 5 weekday days with 1 commit each
      contributions["2024-06-03"] = 1;
      contributions["2024-06-04"] = 1;
      contributions["2024-06-05"] = 1;
      contributions["2024-06-06"] = 1;
      contributions["2024-06-07"] = 1;

      const peakHour = { hour: 10 };
      const result = calculatePersonality(contributions, 210, 10, peakHour, 5, 25);
      expect(result.id).toBe("weekend_warrior");
      expect(result.name).toBe("Weekend Warrior");
      expect(result.icon).toBeTruthy();
      expect(result.description).toBeTruthy();
      expect(result.reason).toContain("%");
    });

    it("returns Night Architect when peak hour is >=22 or <=4", () => {
      const result = getPeakCodingHour([23]);
      const personality = calculatePersonality(
        {},
        100,
        10,
        { hour: 23 },
        5,
        10
      );
      expect(personality.id).toBe("night_architect");
      expect(personality.name).toBe("Night Architect");
    });

    it("returns Night Architect for hour <=4", () => {
      const personality = calculatePersonality(
        {},
        100,
        10,
        { hour: 3 },
        5,
        10
      );
      expect(personality.id).toBe("night_architect");
    });

    it("returns Sprint Builder when commits per active day > 8", () => {
      const personality = calculatePersonality(
        { "2024-01-01": 10, "2024-01-02": 10 },
        20,
        10,
        { hour: 10 },
        2,
        2
      );
      expect(personality.id).toBe("sprint_builder");
    });

    it("returns Silent Architect when >500 commits and <5 PRs", () => {
      // Use enough days so commitsPerActiveDay <= 8 (Sprint Builder threshold)
      const personality = calculatePersonality(
        { "2024-01-01": 1 },
        600,
        3,
        { hour: 10 },
        10,
        100
      );
      expect(personality.id).toBe("silent_architect");
    });

    it("returns Consistency Monk as fallback", () => {
      const personality = calculatePersonality(
        { "2024-01-01": 1 },
        50,
        10,
        { hour: 10 },
        10,
        30
      );
      expect(personality.id).toBe("consistency_monk");
    });

    it("Consistency Monk reason includes streak when >21 days", () => {
      const personality = calculatePersonality(
        { "2024-01-01": 1 },
        50,
        10,
        { hour: 10 },
        30,
        30
      );
      expect(personality.reason).toContain("30-day");
    });

    it("returned object has all required fields", () => {
      const result = calculatePersonality(
        {},
        10,
        5,
        { hour: null },
        5,
        10
      );
      expect(typeof result.id).toBe("string");
      expect(typeof result.name).toBe("string");
      expect(typeof result.icon).toBe("string");
      expect(typeof result.description).toBe("string");
      expect(typeof result.reason).toBe("string");
    });
  });
});
