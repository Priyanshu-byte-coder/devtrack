import { describe, it, expect } from "vitest";
import type {
  ExplorerRepoCardData, RepoContributorData, HeatmapPoint,
  RepoHealth, LanguageSlice, TimelinePoint, RepoAnalyticsResponse,
} from "@/lib/repo-analytics-types";

describe("ExplorerRepoCardData", () => {
  it("accepts a valid data object", () => {
    const data: ExplorerRepoCardData = {
      id: "repo-1", name: "my-repo", fullName: "owner/my-repo", commitCount: 42,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-06-15T00:00:00Z",
      primaryLanguage: "TypeScript", htmlUrl: "https://github.com/owner/my-repo",
      activity7d: [{ day: "2026-06-10", commits: 5 }, { day: "2026-06-11", commits: 3 }],
    };
    expect(data.name).toBe("my-repo");
    expect(data.commitCount).toBe(42);
    expect(data.activity7d).toHaveLength(2);
  });

  it("allows optional fields to be omitted", () => {
    const data: ExplorerRepoCardData = {
      id: "repo-1", name: "minimal", fullName: "owner/minimal", commitCount: 0,
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(data.primaryLanguage).toBeUndefined();
    expect(data.htmlUrl).toBeUndefined();
  });
});

describe("RepoContributorData", () => {
  it("accepts a valid contributor object", () => {
    const c: RepoContributorData = { login: "contributor1", avatarUrl: "https://avatars.githubusercontent.com/u/1", contributions: 150 };
    expect(c.login).toBe("contributor1");
    expect(c.contributions).toBe(150);
  });
});

describe("HeatmapPoint", () => {
  it("has date and count fields", () => {
    const p: HeatmapPoint = { date: "2026-06-15", count: 5 };
    expect(p.date).toBe("2026-06-15");
    expect(p.count).toBe(5);
  });
  it("accepts zero count", () => {
    const p: HeatmapPoint = { date: "2026-01-01", count: 0 };
    expect(p.count).toBe(0);
  });
});

describe("RepoHealth", () => {
  it("has score, signals, grade fields", () => {
    const h: RepoHealth = { score: 87, signals: { openIssues: 3, recentCommits: 15 } as Record<string, number>, grade: "A" };
    expect(h.score).toBe(87);
    expect(h.grade).toBe("A");
  });
});

describe("LanguageSlice", () => {
  it("has name, percentage, color fields", () => {
    const l: LanguageSlice = { name: "TypeScript", percentage: 72.5, color: "#3178c6" };
    expect(l.name).toBe("TypeScript");
    expect(l.percentage).toBe(72.5);
  });
  it("allows zero percentage", () => {
    const l: LanguageSlice = { name: "Unknown", percentage: 0, color: "#999" };
    expect(l.percentage).toBe(0);
  });
});

describe("TimelinePoint", () => {
  it("has date and events fields", () => {
    const p: TimelinePoint = { date: "2026-06-01", events: 8 };
    expect(p.date).toBe("2026-06-01");
    expect(p.events).toBe(8);
  });
});

describe("RepoAnalyticsResponse", () => {
  it("has overview with all required fields", () => {
    const r: RepoAnalyticsResponse = {
      overview: {
        description: "A great repo", stars: 100, forks: 20, openIssues: 5,
        watchers: 10, license: "MIT", defaultBranch: "main",
        createdAt: "2020-01-01T00:00:00Z", updatedAt: "2026-06-15T00:00:00Z",
      },
      contributors: [], timeline: [], health: { score: 0, signals: {}, grade: "F" },
      primaryStack: [], languageBreakdown: [],
    };
    expect(r.overview.stars).toBe(100);
    expect(r.overview.updatedAt).toBe("2026-06-15T00:00:00Z");
    expect(r.overview.description).toBe("A great repo");
  });

  it("allows description to be null", () => {
    const r: RepoAnalyticsResponse = {
      overview: {
        description: null, stars: 0, forks: 0, openIssues: 0, watchers: 0,
        license: "MIT", defaultBranch: "main",
        createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      },
      contributors: [], timeline: [], health: { score: 0, signals: {}, grade: "F" },
      primaryStack: [], languageBreakdown: [],
    };
    expect(r.overview.description).toBeNull();
  });
});
