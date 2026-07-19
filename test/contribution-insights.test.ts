import { describe, it, expect } from "vitest";
import {
  calculateMostProductiveWeekday,
  calculateAverageWeeklyContributions,
  calculateLongestStreak,
  calculateLongestInactivePeriod,
  calculateMonthlyTrend,
  calculateBestContributionMonth,
  getContributionInsights,
  type ContributionDay
} from "@/lib/contribution-insights";

describe("Contribution Heatmap Insights Calculations", () => {
  describe("calculateMostProductiveWeekday", () => {
    it("returns N/A for empty dataset", () => {
      expect(calculateMostProductiveWeekday([])).toBe("N/A");
    });

    it("returns N/A when there are no contributions at all (all counts 0)", () => {
      const days: ContributionDay[] = [
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 0 },
        { date: new Date("2026-06-02"), dateKey: "2026-06-02", count: 0 },
      ];
      expect(calculateMostProductiveWeekday(days)).toBe("N/A");
    });

    it("calculates the weekday with the highest average contributions", () => {
      // 2026-06-01 is a Monday
      // 2026-06-02 is a Tuesday
      // 2026-06-08 is a Monday
      const days: ContributionDay[] = [
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 10 }, // Mon
        { date: new Date("2026-06-02"), dateKey: "2026-06-02", count: 5 },  // Tue
        { date: new Date("2026-06-08"), dateKey: "2026-06-08", count: 12 }, // Mon (Avg Mon = 11)
        { date: new Date("2026-06-09"), dateKey: "2026-06-09", count: 15 }, // Tue (Avg Tue = 10)
      ];
      expect(calculateMostProductiveWeekday(days)).toBe("Monday");
    });
  });

  describe("calculateAverageWeeklyContributions", () => {
    it("returns 0 for empty dataset", () => {
      expect(calculateAverageWeeklyContributions([])).toBe(0);
    });

    it("correctly computes the average contributions per 7 days", () => {
      const days: ContributionDay[] = Array.from({ length: 14 }, (_, i) => ({
        date: new Date(2026, 5, i + 1),
        dateKey: `2026-06-${i + 1}`,
        count: 2,
      }));
      // 14 days, total commits = 28. Average per week should be 28 / (14 / 7) = 14.
      expect(calculateAverageWeeklyContributions(days)).toBe(14);
    });
  });

  describe("calculateLongestStreak", () => {
    it("returns 0 for empty dataset", () => {
      expect(calculateLongestStreak([])).toBe(0);
    });

    it("identifies the longest streak of consecutive days with >=1 contribution", () => {
      const days: ContributionDay[] = [
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 1 },
        { date: new Date("2026-06-02"), dateKey: "2026-06-02", count: 3 },
        { date: new Date("2026-06-03"), dateKey: "2026-06-03", count: 0 },
        { date: new Date("2026-06-04"), dateKey: "2026-06-04", count: 2 },
        { date: new Date("2026-06-05"), dateKey: "2026-06-05", count: 1 },
        { date: new Date("2026-06-06"), dateKey: "2026-06-06", count: 5 },
        { date: new Date("2026-06-07"), dateKey: "2026-06-07", count: 0 },
      ];
      expect(calculateLongestStreak(days)).toBe(3); // Jun 4, 5, 6
    });
  });

  describe("calculateLongestInactivePeriod", () => {
    it("returns 0 for empty dataset", () => {
      expect(calculateLongestInactivePeriod([])).toBe(0);
    });

    it("identifies the maximum number of consecutive days with zero contributions", () => {
      const days: ContributionDay[] = [
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 1 },
        { date: new Date("2026-06-02"), dateKey: "2026-06-02", count: 0 },
        { date: new Date("2026-06-03"), dateKey: "2026-06-03", count: 0 },
        { date: new Date("2026-06-04"), dateKey: "2026-06-04", count: 2 },
        { date: new Date("2026-06-05"), dateKey: "2026-06-05", count: 0 },
        { date: new Date("2026-06-06"), dateKey: "2026-06-06", count: 0 },
        { date: new Date("2026-06-07"), dateKey: "2026-06-07", count: 0 },
        { date: new Date("2026-06-08"), dateKey: "2026-06-08", count: 1 },
      ];
      expect(calculateLongestInactivePeriod(days)).toBe(3); // Jun 5, 6, 7
    });
  });

  describe("calculateMonthlyTrend", () => {
    it("returns Stable for empty dataset", () => {
      expect(calculateMonthlyTrend([])).toBe("Stable");
    });

    it("returns Stable if there is only one month in the dataset", () => {
      const days: ContributionDay[] = [
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 5 },
      ];
      expect(calculateMonthlyTrend(days)).toBe("Stable");
    });

    it("returns Increasing if recent month daily average has increased by > 10%", () => {
      const days: ContributionDay[] = [
        // May 2026: 2 days, avg = 10
        { date: new Date("2026-05-15"), dateKey: "2026-05-15", count: 10 },
        { date: new Date("2026-05-16"), dateKey: "2026-05-16", count: 10 },
        // June 2026: 2 days, avg = 15 (50% increase)
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 15 },
        { date: new Date("2026-06-02"), dateKey: "2026-06-02", count: 15 },
      ];
      expect(calculateMonthlyTrend(days)).toBe("Increasing");
    });

    it("returns Decreasing if recent month daily average has decreased by > 10%", () => {
      const days: ContributionDay[] = [
        // May 2026: 2 days, avg = 10
        { date: new Date("2026-05-15"), dateKey: "2026-05-15", count: 10 },
        { date: new Date("2026-05-16"), dateKey: "2026-05-16", count: 10 },
        // June 2026: 2 days, avg = 5 (50% decrease)
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 5 },
        { date: new Date("2026-06-02"), dateKey: "2026-06-02", count: 5 },
      ];
      expect(calculateMonthlyTrend(days)).toBe("Decreasing");
    });

    it("returns Stable if change is within 10%", () => {
      const days: ContributionDay[] = [
        // May 2026: 2 days, avg = 10
        { date: new Date("2026-05-15"), dateKey: "2026-05-15", count: 10 },
        { date: new Date("2026-05-16"), dateKey: "2026-05-16", count: 10 },
        // June 2026: 2 days, avg = 10.5 (5% increase)
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 10 },
        { date: new Date("2026-06-02"), dateKey: "2026-06-02", count: 11 },
      ];
      expect(calculateMonthlyTrend(days)).toBe("Stable");
    });
  });

  describe("calculateBestContributionMonth", () => {
    it("returns N/A for empty dataset", () => {
      expect(calculateBestContributionMonth([]).monthName).toBe("N/A");
    });

    it("identifies the month with the highest total contributions", () => {
      const days: ContributionDay[] = [
        { date: new Date("2026-04-15"), dateKey: "2026-04-15", count: 15 }, // Apr total = 15
        { date: new Date("2026-05-15"), dateKey: "2026-05-15", count: 10 }, // May total = 30
        { date: new Date("2026-05-16"), dateKey: "2026-05-16", count: 20 },
        { date: new Date("2026-06-01"), dateKey: "2026-06-01", count: 5 },  // Jun total = 5
      ];
      const result = calculateBestContributionMonth(days);
      expect(result.monthName).toBe("May 2026");
      expect(result.total).toBe(30);
    });
  });

  describe("getContributionInsights", () => {
    it("returns aggregated results correctly", () => {
      const days: ContributionDay[] = [
        { date: new Date("2026-05-01"), dateKey: "2026-05-01", count: 5 }, // Fri
        { date: new Date("2026-05-02"), dateKey: "2026-05-02", count: 0 },
        { date: new Date("2026-05-03"), dateKey: "2026-05-03", count: 10 }, // Sun
      ];
      const insights = getContributionInsights(days);
      expect(insights.longestStreak).toBe(1);
      expect(insights.longestInactivePeriod).toBe(1);
      expect(insights.bestMonth).toBe("May 2026");
      expect(insights.bestMonthTotal).toBe(15);
    });
  });

  describe("Multi-year support", () => {
    it("handles contributions spanning multiple years", () => {
      const days: ContributionDay[] = [
        { date: new Date("2025-12-31"), dateKey: "2025-12-31", count: 5 },
        { date: new Date("2026-01-01"), dateKey: "2026-01-01", count: 10 },
      ];
      const insights = getContributionInsights(days);
      // Best month should be Jan 2026 (total 10) vs Dec 2025 (total 5)
      expect(insights.bestMonth).toBe("January 2026");
      expect(insights.bestMonthTotal).toBe(10);
    });
  });
});
