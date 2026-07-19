import { describe, it, expect } from "vitest";
import {
  ExplorerRepoCardData,
  RepoContributorData,
  HeatmapPoint,
  RepoHealth,
  LanguageSlice,
  TimelinePoint,
  RepoAnalyticsResponse,
} from "../src/lib/repo-analytics-types";

describe("repoAnalytics Type Structure Validation", () => {
  describe("ExplorerRepoCardData Type Validation", () => {
    it("should validate a complete ExplorerRepoCardData object", () => {
      const mockRepoCard: ExplorerRepoCardData = {
        id: "repo-123",
        name: "devtrack",
        fullName: "Priyanshu-byte-coder/devtrack",
        commitCount: 150,
        createdAt: "2026-05-20T12:00:00Z",
        updatedAt: "2026-05-31T12:00:00Z",
        primaryLanguage: "TypeScript",
        htmlUrl: "https://github.com/Priyanshu-byte-coder/devtrack",
        activity7d: [
          { day: "Monday", commits: 5 },
          { day: "Tuesday", commits: 8 },
        ],
      };

      expect(mockRepoCard.id).toBeTypeOf("string");
      expect(mockRepoCard.name).toBeTypeOf("string");
      expect(mockRepoCard.fullName).toBeTypeOf("string");
      expect(mockRepoCard.commitCount).toBeTypeOf("number");
      expect(mockRepoCard.createdAt).toBeTypeOf("string");
      expect(mockRepoCard.updatedAt).toBeTypeOf("string");
      expect(mockRepoCard.primaryLanguage).toBe("TypeScript");
      expect(mockRepoCard.htmlUrl).toBe("https://github.com/Priyanshu-byte-coder/devtrack");
      expect(mockRepoCard.activity7d).toBeInstanceOf(Array);
      expect(mockRepoCard.activity7d?.[0].commits).toBe(5);
    });

    it("should validate a minimal ExplorerRepoCardData object without optional fields", () => {
      const mockRepoCard: ExplorerRepoCardData = {
        id: "repo-124",
        name: "minimal-repo",
        fullName: "test-user/minimal-repo",
        commitCount: 0,
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
      };

      expect(mockRepoCard.id).toBe("repo-124");
      expect(mockRepoCard.name).toBe("minimal-repo");
      expect(mockRepoCard.commitCount).toBe(0);
      expect(mockRepoCard.primaryLanguage).toBeUndefined();
      expect(mockRepoCard.htmlUrl).toBeUndefined();
      expect(mockRepoCard.activity7d).toBeUndefined();
    });
  });

  describe("RepoContributorData Type Validation", () => {
    it("should validate RepoContributorData properties", () => {
      const mockContributor: RepoContributorData = {
        login: "octocat",
        avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
        contributions: 42,
      };

      expect(mockContributor.login).toBeTypeOf("string");
      expect(mockContributor.avatarUrl).toBeTypeOf("string");
      expect(mockContributor.contributions).toBeTypeOf("number");
    });
  });

  describe("HeatmapPoint Type Validation", () => {
    it("should validate HeatmapPoint properties", () => {
      const mockPoint: HeatmapPoint = {
        date: "2026-05-30",
        count: 7,
      };

      expect(mockPoint.date).toBeTypeOf("string");
      expect(mockPoint.count).toBeTypeOf("number");
    });
  });

  describe("RepoHealth Type Validation", () => {
    it("should validate RepoHealth properties", () => {
      const mockHealth: RepoHealth = {
        score: 95,
        signals: { prOpenDuration: 2.4, issuesAge: 12 },
        grade: "A+",
      };

      expect(mockHealth.score).toBeTypeOf("number");
      expect(mockHealth.signals).toBeTypeOf("object");
      expect(mockHealth.grade).toBeTypeOf("string");
    });
  });

  describe("LanguageSlice Type Validation", () => {
    it("should validate LanguageSlice properties", () => {
      const mockLanguage: LanguageSlice = {
        name: "TypeScript",
        percentage: 84.5,
        color: "#3178c6",
      };

      expect(mockLanguage.name).toBeTypeOf("string");
      expect(mockLanguage.percentage).toBeTypeOf("number");
      expect(mockLanguage.color).toBeTypeOf("string");
    });
  });

  describe("TimelinePoint Type Validation", () => {
    it("should validate TimelinePoint properties", () => {
      const mockTimeline: TimelinePoint = {
        date: "2026-05-24",
        events: 12,
      };

      expect(mockTimeline.date).toBeTypeOf("string");
      expect(mockTimeline.events).toBeTypeOf("number");
    });
  });

  describe("RepoAnalyticsResponse Type Validation", () => {
    it("should validate a complete RepoAnalyticsResponse object structure", () => {
      const mockResponse: RepoAnalyticsResponse = {
        overview: {
          description: "A developer productivity dashboard",
          stars: 124,
          forks: 32,
          openIssues: 5,
          watchers: 8,
          license: "MIT",
          defaultBranch: "main",
          createdAt: "2026-01-01T12:00:00Z",
          updatedAt: "2026-05-31T18:00:00Z",
        },
        contributors: [
          {
            login: "alice",
            avatarUrl: "https://avatar.url/alice",
            contributions: 120,
          },
          {
            login: "bob",
            avatarUrl: "https://avatar.url/bob",
            contributions: 45,
          },
        ],
        timeline: [
          { date: "May 24", events: 3 },
          { date: "May 25", events: 0 },
        ],
        health: {
          score: 88,
          signals: { openIssues: 5, lastCommitDaysAgo: 1 },
          grade: "B+",
        },
        primaryStack: ["TypeScript", "CSS", "HTML"],
        languageBreakdown: [
          { name: "TypeScript", percentage: 90, color: "#3178c6" },
          { name: "CSS", percentage: 10, color: "#563d7c" },
        ],
      };

      // Overview Assertions
      expect(mockResponse.overview).toBeTypeOf("object");
      expect(mockResponse.overview.description).toBe("A developer productivity dashboard");
      expect(mockResponse.overview.stars).toBe(124);
      expect(mockResponse.overview.forks).toBe(32);
      expect(mockResponse.overview.openIssues).toBe(5);
      expect(mockResponse.overview.watchers).toBe(8);
      expect(mockResponse.overview.license).toBe("MIT");
      expect(mockResponse.overview.defaultBranch).toBe("main");
      expect(mockResponse.overview.createdAt).toBe("2026-01-01T12:00:00Z");
      expect(mockResponse.overview.updatedAt).toBe("2026-05-31T18:00:00Z");

      // Contributors Assertions
      expect(mockResponse.contributors).toBeInstanceOf(Array);
      expect(mockResponse.contributors).toHaveLength(2);
      expect(mockResponse.contributors[0].login).toBe("alice");

      // Timeline Assertions
      expect(mockResponse.timeline).toBeInstanceOf(Array);
      expect(mockResponse.timeline).toHaveLength(2);
      expect(mockResponse.timeline[0].events).toBe(3);

      // Health Assertions
      expect(mockResponse.health).toBeTypeOf("object");
      expect(mockResponse.health.score).toBe(88);
      expect(mockResponse.health.grade).toBe("B+");

      // Language & Stack Assertions
      expect(mockResponse.primaryStack).toContain("TypeScript");
      expect(mockResponse.languageBreakdown[0].name).toBe("TypeScript");
      expect(mockResponse.languageBreakdown[0].percentage).toBe(90);
    });

    it("should validate RepoAnalyticsResponse structure with null optional description", () => {
      const mockResponse: RepoAnalyticsResponse = {
        overview: {
          description: null,
          stars: 0,
          forks: 0,
          openIssues: 0,
          watchers: 0,
          license: "No License",
          defaultBranch: "master",
          createdAt: "2026-06-01T00:00:00Z",
          updatedAt: "2026-06-01T00:00:00Z",
        },
        contributors: [],
        timeline: [],
        health: {
          score: 100,
          signals: null,
          grade: "A",
        },
        primaryStack: [],
        languageBreakdown: [],
      };

      expect(mockResponse.overview.description).toBeNull();
      expect(mockResponse.contributors).toHaveLength(0);
      expect(mockResponse.timeline).toHaveLength(0);
      expect(mockResponse.health.score).toBe(100);
      expect(mockResponse.languageBreakdown).toHaveLength(0);
    });
  });
});
