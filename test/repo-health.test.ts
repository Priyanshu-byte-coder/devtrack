import { describe, it, expect } from "vitest";
import {
  scoreCommitFrequency,
  scorePrMergeRate,
  scoreAvgPrOpenTimeHours,
  scoreOpenIssuesCount,
  scoreDaysSinceLastCommit,
  gradeForScore,
  computeHealthScore,
} from "../src/lib/repo-health";
import type { RepoHealthSignals } from "@/types/repo-health";

describe("repo-health scoring utilities", () => {
  describe("scoreCommitFrequency", () => {
    it("returns 0 for 0 commits", () => {
      expect(scoreCommitFrequency(0)).toBe(0);
    });

    it("returns 25 for 10+ commits", () => {
      expect(scoreCommitFrequency(10)).toBe(25);
      expect(scoreCommitFrequency(15)).toBe(25);
    });

    it("returns proportional score for 1-9 commits", () => {
      expect(scoreCommitFrequency(5)).toBe(12.5);
    });

    it("handles NaN gracefully", () => {
      expect(scoreCommitFrequency(NaN)).toBe(0);
    });
  });

  describe("scorePrMergeRate", () => {
    it("returns 0 for 0 rate", () => {
      expect(scorePrMergeRate(0)).toBe(0);
    });

    it("returns 25 for rate of 1", () => {
      expect(scorePrMergeRate(1)).toBe(25);
    });

    it("returns half for rate of 0.5", () => {
      expect(scorePrMergeRate(0.5)).toBe(12.5);
    });

    it("clamps rate above 1", () => {
      expect(scorePrMergeRate(2)).toBe(25);
    });
  });

  describe("scoreAvgPrOpenTimeHours", () => {
    it("returns 20 for avg hours <= 24", () => {
      expect(scoreAvgPrOpenTimeHours(0)).toBe(20);
      expect(scoreAvgPrOpenTimeHours(24)).toBe(20);
    });

    it("returns 0 for avg hours >= 168 (1 week)", () => {
      expect(scoreAvgPrOpenTimeHours(168)).toBe(0);
      expect(scoreAvgPrOpenTimeHours(200)).toBe(0);
    });

    it("returns proportional score between 24 and 168 hours", () => {
      const score96 = scoreAvgPrOpenTimeHours(96);
      expect(score96).toBeGreaterThan(0);
      expect(score96).toBeLessThan(20);
    });
  });

  describe("scoreOpenIssuesCount", () => {
    it("returns 15 for 0 open issues", () => {
      expect(scoreOpenIssuesCount(0)).toBe(15);
    });

    it("returns 0 for 20+ open issues", () => {
      expect(scoreOpenIssuesCount(20)).toBe(0);
      expect(scoreOpenIssuesCount(50)).toBe(0);
    });

    it("returns proportional score between 0 and 20", () => {
      expect(scoreOpenIssuesCount(10)).toBe(7.5);
    });
  });

  describe("scoreDaysSinceLastCommit", () => {
    it("returns 15 for <= 7 days", () => {
      expect(scoreDaysSinceLastCommit(0)).toBe(15);
      expect(scoreDaysSinceLastCommit(7)).toBe(15);
    });

    it("returns 0 for >= 30 days", () => {
      expect(scoreDaysSinceLastCommit(30)).toBe(0);
      expect(scoreDaysSinceLastCommit(100)).toBe(0);
    });

    it("returns proportional score between 7 and 30 days", () => {
      const score18 = scoreDaysSinceLastCommit(18);
      expect(score18).toBeGreaterThan(0);
      expect(score18).toBeLessThan(15);
    });
  });

  describe("gradeForScore", () => {
    it("returns green for score >= 70", () => {
      expect(gradeForScore(70)).toBe("green");
      expect(gradeForScore(100)).toBe("green");
    });

    it("returns yellow for score >= 40 and < 70", () => {
      expect(gradeForScore(40)).toBe("yellow");
      expect(gradeForScore(69)).toBe("yellow");
    });

    it("returns red for score < 40", () => {
      expect(gradeForScore(39)).toBe("red");
      expect(gradeForScore(0)).toBe("red");
    });
  });

  describe("computeHealthScore", () => {
    it("computes health score from signals", () => {
      const signals: RepoHealthSignals = {
        commitFrequency: 10,
        prMergeRate: 1,
        avgPrOpenTimeHours: 24,
        openIssuesCount: 0,
        daysSinceLastCommit: 7,
        contributorCount: 10,
        documentationScore: 100,
      };
      const result = computeHealthScore("owner/repo", signals);
      expect(result.repo).toBe("owner/repo");
      expect(result.score).toBe(100);
      expect(result.grade).toBe("green");
    });

    it("returns red grade for low activity repo", () => {
      const signals: RepoHealthSignals = {
        commitFrequency: 0,
        prMergeRate: 0,
        avgPrOpenTimeHours: 200,
        openIssuesCount: 25,
        daysSinceLastCommit: 35,
        contributorCount: 0,
        documentationScore: 0,
      };
      const result = computeHealthScore("owner/repo", signals);
      expect(result.score).toBe(0);
      expect(result.grade).toBe("red");
    });
  });
});