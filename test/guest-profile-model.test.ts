import { describe, expect, it } from "vitest";
import {
  buildGuestProfile,
  estimateGuestRank,
  isIndexableGuest,
  type GuestProfile,
  type GuestUserNode,
} from "../src/lib/guest-profile-model";
import type { LeaderboardEntry } from "../src/lib/leaderboard";

function day(offset: number) {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

function node(overrides: Partial<GuestUserNode> = {}): GuestUserNode {
  return {
    login: "Octocat",
    name: "  The Octocat ",
    bio: "",
    createdAt: "2015-01-01T00:00:00Z",
    followers: { totalCount: 10 },
    repositories: {
      totalCount: 4,
      nodes: [
        {
          name: "a",
          url: "u/a",
          description: null,
          stargazerCount: 3,
          primaryLanguage: { name: "Go" },
        },
        {
          name: "b",
          url: "u/b",
          description: "b",
          stargazerCount: 90,
          primaryLanguage: { name: "TypeScript" },
        },
        null,
        {
          name: "c",
          url: "u/c",
          description: null,
          stargazerCount: 7,
          primaryLanguage: { name: "TypeScript" },
        },
        {
          name: "d",
          url: "u/d",
          description: null,
          stargazerCount: 0,
          primaryLanguage: null,
        },
      ],
    },
    contributionsCollection: {
      contributionYears: [2026, 2025],
      totalCommitContributions: 40,
      totalPullRequestContributions: 5,
      totalPullRequestReviewContributions: 2,
      totalRepositoriesWithContributedCommits: 3,
      contributionCalendar: {
        totalContributions: 47,
        weeks: [
          {
            contributionDays: [
              { date: day(4), contributionCount: 1 },
              { date: day(3), contributionCount: 0 },
              { date: day(2), contributionCount: 2 },
              { date: day(1), contributionCount: 5 },
              { date: day(0), contributionCount: 1 },
            ],
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("buildGuestProfile", () => {
  it("derives streaks, activity and display fields from the calendar", () => {
    const p = buildGuestProfile(node(), null);
    expect(p.name).toBe("The Octocat");
    expect(p.bio).toBeNull();
    expect(p.activeDays).toBe(4);
    expect(p.streak).toEqual({ current: 3, longest: 3 });
    expect(p.yearContributions).toBe(47);
    expect(p.calendar).toHaveLength(5);
  });

  it("sorts repositories by stars and skips null nodes", () => {
    const p = buildGuestProfile(node(), null);
    expect(p.topRepos.map((r) => r.name)).toEqual(["b", "c", "a", "d"]);
  });

  it("shares languages across repositories", () => {
    const p = buildGuestProfile(node(), null);
    expect(p.topLanguages[0]).toMatchObject({ name: "TypeScript", count: 2 });
    expect(p.topLanguages.reduce((s, l) => s + l.percentage, 0)).toBeCloseTo(
      100,
      0
    );
  });

  it("sums lifetime totals per year, falling back to the last year", () => {
    expect(buildGuestProfile(node(), null).lifetime).toEqual({
      commits: 40,
      prs: 5,
      reviews: 2,
    });
    const years = [
      {
        totalCommitContributions: 100,
        totalPullRequestContributions: 10,
        totalPullRequestReviewContributions: 1,
      },
      {
        totalCommitContributions: 50,
        totalPullRequestContributions: 4,
        totalPullRequestReviewContributions: 3,
      },
    ];
    expect(buildGuestProfile(node(), years).lifetime).toEqual({
      commits: 150,
      prs: 14,
      reviews: 4,
    });
  });
});

function guest(overrides: Partial<GuestProfile> = {}): GuestProfile {
  return { ...buildGuestProfile(node(), null), ...overrides };
}

describe("isIndexableGuest", () => {
  const now = new Date("2026-11-03T00:00:00Z");

  it("indexes established, active accounts", () => {
    expect(
      isIndexableGuest(guest({ yearContributions: 300, activeDays: 80 }), now)
    ).toBe(true);
  });

  it("indexes well-followed accounts even when quiet", () => {
    expect(
      isIndexableGuest(
        guest({ followers: 500, yearContributions: 0, activeDays: 0 }),
        now
      )
    ).toBe(true);
  });

  it("keeps thin and brand-new accounts out of the index", () => {
    expect(
      isIndexableGuest(
        guest({ yearContributions: 3, activeDays: 2, followers: 1 }),
        now
      )
    ).toBe(false);
    expect(
      isIndexableGuest(
        guest({
          githubSince: "2026-10-01T00:00:00Z",
          followers: 900,
          yearContributions: 900,
          activeDays: 200,
        }),
        now
      )
    ).toBe(false);
  });
});

function entry(id: string, username: string, n: number): LeaderboardEntry {
  return {
    id,
    rank: 0,
    username,
    avatarUrl: "",
    profileUrl: "",
    streak: n,
    commits: n * 100,
    prs: n * 10,
    score: 0,
    isSponsor: false,
    activeDays: n * 20,
    reviews: n * 5,
    repos: n,
  };
}

describe("estimateGuestRank", () => {
  const board = [
    entry("1", "big", 9),
    entry("2", "mid", 4),
    entry("3", "small", 1),
  ];

  it("places a guest among the board", () => {
    const strong = estimateGuestRank(
      guest({
        activeDays: 365,
        streak: { current: 365, longest: 365 },
        lifetime: { commits: 20_000, prs: 2_000, reviews: 1_000 },
        reposContributed: 40,
      }),
      board
    );
    expect(strong.rank).toBe(1);
    expect(strong.total).toBe(4);

    const weak = estimateGuestRank(
      guest({
        activeDays: 0,
        streak: { current: 0, longest: 0 },
        lifetime: { commits: 0, prs: 0, reviews: 0 },
        reposContributed: 0,
      }),
      board
    );
    expect(weak.rank).toBe(4);
    expect(weak.xp).toBe(0);
  });

  it("dedupes metric boards and skips the guest's own stale entry", () => {
    const est = estimateGuestRank(guest(), [
      ...board,
      ...board,
      entry("9", "OCTOCAT", 50),
    ]);
    expect(est.total).toBe(4);
  });

  it("works with an empty board", () => {
    const est = estimateGuestRank(guest(), []);
    expect(est).toMatchObject({ rank: 1, total: 1 });
  });
});
