import { describe, expect, it } from "vitest";
import {
  PROFILE_STATS_QUERY,
  buildProfileStats,
  type ProfileStatsNode,
} from "@/lib/profile-stats";

function node(): ProfileStatsNode {
  return {
    pullRequests: { totalCount: 42 },
    repositories: {
      nodes: [
        { primaryLanguage: { name: "TypeScript" } },
        { primaryLanguage: { name: "TypeScript" } },
        { primaryLanguage: { name: "Go" } },
        { primaryLanguage: null },
        null,
      ],
    },
    year: {
      contributionCalendar: {
        weeks: [
          {
            contributionDays: [
              { date: "2026-10-30", contributionCount: 0 },
              { date: "2026-10-31", contributionCount: 4 },
              { date: "2026-11-01", contributionCount: 2 },
            ],
          },
        ],
      },
    },
    recent: {
      commitContributionsByRepository: [
        {
          repository: {
            nameWithOwner: "me/app",
            url: "u/app",
            isPrivate: false,
          },
          contributions: {
            nodes: [
              { occurredAt: "2026-11-01T00:00:00Z", commitCount: 3 },
              { occurredAt: "2026-10-31T00:00:00Z", commitCount: 1 },
            ],
          },
        },
        {
          repository: {
            nameWithOwner: "me/secret",
            url: "u/secret",
            isPrivate: true,
          },
          contributions: {
            nodes: [{ occurredAt: "2026-11-01T00:00:00Z", commitCount: 50 }],
          },
        },
        {
          repository: {
            nameWithOwner: "org/lib",
            url: "u/lib",
            isPrivate: false,
          },
          contributions: {
            nodes: [
              { occurredAt: "2026-11-01T00:00:00Z", commitCount: 5 },
              null,
            ],
          },
        },
      ],
    },
  };
}

describe("buildProfileStats", () => {
  it("never counts private repositories", () => {
    const stats = buildProfileStats(node(), 30);
    expect(stats.repos.map((r) => r.name)).not.toContain("me/secret");
    expect(stats.contributions.total).toBe(9);
  });

  it("sums public commits per day", () => {
    expect(buildProfileStats(node(), 30).contributions.data).toEqual({
      "2026-11-01": 8,
      "2026-10-31": 1,
    });
  });

  it("ranks repositories by commits", () => {
    expect(buildProfileStats(node(), 30).repos).toEqual([
      { name: "org/lib", url: "u/lib", commits: 5 },
      { name: "me/app", url: "u/app", commits: 4 },
    ]);
  });

  it("shares languages across repositories", () => {
    const langs = buildProfileStats(node(), 30).topLanguages;
    expect(langs[0]).toMatchObject({ name: "TypeScript", count: 2 });
    expect(langs.reduce((s, l) => s + l.percentage, 0)).toBeCloseTo(100, 0);
  });

  it("keeps active days for the streak, and the counts", () => {
    const stats = buildProfileStats(node(), 30);
    expect([...stats.activeDates].sort()).toEqual(["2026-10-31", "2026-11-01"]);
    expect(stats.pullRequests).toBe(42);
  });

  it("doesn't ask GraphQL for gists, which GitHub App tokens can't read", () => {
    // "Resource not accessible by integration" failed every member profile.
    expect(PROFILE_STATS_QUERY).not.toMatch(/gists/);
  });
});
