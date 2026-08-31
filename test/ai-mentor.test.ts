import { describe, it, expect } from "vitest";
import { analyzePatterns, computeTrends, DeveloperMetrics } from "../src/lib/ai-mentor";

describe("ai-mentor utility functions", () => {
  describe("analyzePatterns", () => {
    const createBaseMetrics = (): DeveloperMetrics => ({
      commits: [
        { date: "2026-05-01", count: 2 },
        { date: "2026-05-02", count: 3 },
      ],
      prs: {
        merged: 5,
        open: 1,
        avgMergeTimeDays: 5,
      },
      streak: {
        current: 3,
        longest: 5,
        activeDays: 2,
      },
      repos: [
        { name: "repo-a", commits: 5 },
      ],
    });

    it("should return empty insights with default base metrics", () => {
      const metrics = createBaseMetrics();
      const insights = analyzePatterns(metrics);
      // Average commits = 5 / 2 = 2.5 (<= 8)
      // Active days last 30 = 2 (< 10) -> warning: low-consistency
      // Top repo concentration = 100% -> repo-concentration
      // avgMergeTimeDays = 5 (>= 2)
      // streak.current = 3 (< 7)
      expect(insights.some((i) => i.id === "low-consistency")).toBe(true);
      expect(insights.some((i) => i.id === "repo-concentration")).toBe(true);
      expect(insights.some((i) => i.id === "large-commits")).toBe(false);
      expect(insights.some((i) => i.id === "fast-prs")).toBe(false);
      expect(insights.some((i) => i.id === "streak-milestone")).toBe(false);
    });

    it("should trigger large-commits insight when average commits per active day > 8", () => {
      const metrics = createBaseMetrics();
      metrics.commits = [
        { date: "2026-05-01", count: 18 },
      ];
      metrics.streak.activeDays = 1;
      
      const insights = analyzePatterns(metrics);
      const largeCommits = insights.find((i) => i.id === "large-commits");
      expect(largeCommits).toBeDefined();
      expect(largeCommits?.severity).toBe("neutral");
      expect(largeCommits?.type).toBe("recommendation");
    });

    it("should trigger high-consistency insight when active days last 30 >= 20", () => {
      const metrics = createBaseMetrics();
      const commits: { date: string; count: number }[] = [];
      for (let i = 1; i <= 30; i++) {
        commits.push({ date: `2026-05-${i}`, count: i <= 22 ? 1 : 0 });
      }
      metrics.commits = commits;
      metrics.streak.activeDays = 22;

      const insights = analyzePatterns(metrics);
      expect(insights.some((i) => i.id === "high-consistency")).toBe(true);
      expect(insights.some((i) => i.id === "low-consistency")).toBe(false);
    });

    it("should trigger repo-concentration when concentration is > 80%", () => {
      const metrics = createBaseMetrics();
      metrics.repos = [
        { name: "repo-a", commits: 90 },
        { name: "repo-b", commits: 10 },
      ];

      const insights = analyzePatterns(metrics);
      expect(insights.some((i) => i.id === "repo-concentration")).toBe(true);
    });

    it("should not trigger repo-concentration when concentration <= 80%", () => {
      const metrics = createBaseMetrics();
      metrics.repos = [
        { name: "repo-a", commits: 50 },
        { name: "repo-b", commits: 50 },
      ];

      const insights = analyzePatterns(metrics);
      expect(insights.some((i) => i.id === "repo-concentration")).toBe(false);
    });

    it("should trigger fast-prs when avgMergeTimeDays < 2", () => {
      const metrics = createBaseMetrics();
      metrics.prs.avgMergeTimeDays = 1.5;

      const insights = analyzePatterns(metrics);
      const fastPrs = insights.find((i) => i.id === "fast-prs");
      expect(fastPrs).toBeDefined();
      expect(fastPrs?.severity).toBe("positive");
    });

    it("should trigger streak-milestone when current streak >= 7", () => {
      const metrics = createBaseMetrics();
      metrics.streak.current = 10;

      const insights = analyzePatterns(metrics);
      const streak = insights.find((i) => i.id === "streak-milestone");
      expect(streak).toBeDefined();
      expect(streak?.title).toContain("10-day coding streak");
    });
  });

  describe("computeTrends", () => {
    it("should return upward trend with zero percentage for empty commits list", () => {
      const metrics: DeveloperMetrics = {
        commits: [],
        prs: { merged: 0, open: 0, avgMergeTimeDays: 0 },
        streak: { current: 0, longest: 0, activeDays: 0 },
        repos: [],
      };
      const trend = computeTrends(metrics);
      expect(trend.direction).toBe("up");
      expect(trend.percentage).toBe(0);
    });

    it("should compute upward trend percentage correctly", () => {
      const metrics: DeveloperMetrics = {
        commits: [
          { date: "2026-05-01", count: 2 },
          { date: "2026-05-02", count: 4 },
        ],
        prs: { merged: 0, open: 0, avgMergeTimeDays: 0 },
        streak: { current: 0, longest: 0, activeDays: 0 },
        repos: [],
      };
      // mid = 1, firstHalf = commits[0].count = 2, secondHalf = commits[1].count = 4
      // trendPercent = (4 - 2) / 2 * 100 = 100%
      const trend = computeTrends(metrics);
      expect(trend.direction).toBe("up");
      expect(trend.percentage).toBe(100);
    });

    it("should compute downward trend percentage correctly", () => {
      const metrics: DeveloperMetrics = {
        commits: [
          { date: "2026-05-01", count: 5 },
          { date: "2026-05-02", count: 1 },
        ],
        prs: { merged: 0, open: 0, avgMergeTimeDays: 0 },
        streak: { current: 0, longest: 0, activeDays: 0 },
        repos: [],
      };
      // firstHalf = 5, secondHalf = 1
      // trendPercent = (1 - 5) / 5 * 100 = -80%
      const trend = computeTrends(metrics);
      expect(trend.direction).toBe("down");
      expect(trend.percentage).toBe(80);
    });
  });
});
