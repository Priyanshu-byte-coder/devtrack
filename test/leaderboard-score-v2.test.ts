/**
 * Score v2 runs alongside the legacy score: every entry gets scoreV2 and a
 * tier, but rankings must not change until the cutover.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  githubRequest: vi.fn(),
  users: [] as Array<{ id: string; github_login: string; is_sponsor: boolean }>,
}));

vi.mock("@/lib/github-request", () => ({ githubRequest: mocks.githubRequest }));
vi.mock("@/lib/crypto", () => ({ decryptToken: vi.fn(() => null) }));
vi.mock("@/lib/metrics-cache", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
  invalidateLeaderboardCache: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/supabase", () => {
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    const result =
      table === "users"
        ? { data: mocks.users, error: null }
        : { data: [], error: null };
    for (const m of ["select", "eq", "in", "order"]) chain[m] = () => chain;
    chain.limit = () => Promise.resolve(result);
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  };
  return { supabaseAdmin: { from: query } };
});

type Profile = {
  days: string[];
  commits: number;
  prs: number;
  reviews: number;
  repos: number;
};

function graphqlResponse(profile: Profile) {
  return {
    ok: true,
    json: async () => ({
      data: {
        user: {
          year: {
            contributionYears: [2026],
            contributionCalendar: {
              weeks: [
                {
                  contributionDays: profile.days.map((date) => ({
                    date,
                    contributionCount: 1,
                  })),
                },
              ],
            },
          },
          period: {
            totalCommitContributions: profile.commits,
            totalPullRequestContributions: profile.prs,
            totalPullRequestReviewContributions: profile.reviews,
            totalRepositoriesWithContributedCommits: profile.repos,
          },
        },
      },
    }),
  };
}

const today = new Date();
const daysAgo = (n: number) =>
  new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);

const profiles: Record<string, Profile> = {
  // Many commits, nothing else: the legacy score loves this.
  spammer: { days: [daysAgo(1)], commits: 300, prs: 0, reviews: 0, repos: 1 },
  // Fewer commits but active most days, with PRs and reviews across repos.
  steady: {
    days: Array.from({ length: 20 }, (_, i) => daysAgo(i)),
    commits: 60,
    prs: 12,
    reviews: 10,
    repos: 6,
  },
};

describe("buildLeaderboard with score v2", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GITHUB_TOKEN = "test-token";
    mocks.users = [
      { id: "u-spam", github_login: "spammer", is_sponsor: false },
      { id: "u-steady", github_login: "steady", is_sponsor: false },
    ];
    mocks.githubRequest.mockImplementation(
      async (_url: string, init: { body: string }) => {
        const { query, variables } = JSON.parse(init.body);
        const profile = profiles[variables.login];
        // The all-time board asks for per-year totals in a second query.
        if (query.includes("LeaderboardAllTime")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                user: {
                  y2026: {
                    totalCommitContributions: profile.commits,
                    totalPullRequestContributions: profile.prs,
                    totalPullRequestReviewContributions: profile.reviews,
                  },
                },
              },
            }),
          };
        }
        return graphqlResponse(profile);
      }
    );
  });

  it("adds scoreV2, a tier and the new activity fields to every entry", async () => {
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const payload = await buildLeaderboard({ period: "month" });

    for (const entry of payload.leaders.commits) {
      expect(entry.scoreV2).toBeGreaterThanOrEqual(0);
      expect(entry.scoreV2).toBeLessThanOrEqual(1000);
      expect(entry.tier).toMatch(
        /^(bronze|silver|gold|platinum|diamond|legend)$/
      );
    }
    const steady = payload.leaders.commits.find(
      (e) => e.username === "steady"
    )!;
    expect(steady.activeDays).toBe(20);
    expect(steady.reviews).toBe(10);
    expect(steady.repos).toBe(6);
  });

  it("scores the steady contributor above the commit spammer under v2", async () => {
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const payload = await buildLeaderboard({ period: "month" });
    const by = (name: string) =>
      payload.leaders.commits.find((e) => e.username === name)!;
    expect(by("steady").scoreV2!).toBeGreaterThan(by("spammer").scoreV2!);
    // ...while the legacy score, still used for ranking, prefers the spammer.
    expect(by("spammer").score).toBeGreaterThan(by("steady").score);
  });

  it("does not change rankings yet: the commits board still ranks by commits", async () => {
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const payload = await buildLeaderboard({ period: "month" });
    expect(payload.leaders.commits.map((e) => e.username)).toEqual([
      "spammer",
      "steady",
    ]);
  });

  it("only attaches XP and level on the all-time board", async () => {
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const month = await buildLeaderboard({ period: "month" });
    expect(month.leaders.commits[0].xp).toBeUndefined();

    const all = await buildLeaderboard({ period: "all" });
    const steady = all.leaders.commits.find((e) => e.username === "steady")!;
    // 60 commits x10 + 12 PRs x40 + 10 reviews x15
    expect(steady.xp).toBe(600 + 480 + 150);
    expect(steady.level).toBeGreaterThan(1);
  });

  it("ranks every player, not just the first fifty", async () => {
    mocks.users = Array.from({ length: 60 }, (_, i) => ({
      id: `u-${i}`,
      github_login: i % 2 ? "steady" : "spammer",
      is_sponsor: false,
    }));
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const payload = await buildLeaderboard({ period: "month" });
    for (const board of Object.values(payload.leaders)) {
      expect(board).toHaveLength(60);
      expect(board.at(-1)!.rank).toBe(60);
    }
  });

  it("never has more GitHub requests in flight than the concurrency limit", async () => {
    mocks.users = Array.from({ length: 30 }, (_, i) => ({
      id: `u-${i}`,
      github_login: "steady",
      is_sponsor: false,
    }));
    let inFlight = 0;
    let peak = 0;
    mocks.githubRequest.mockImplementation(async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return graphqlResponse(profiles.steady);
    });
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    await buildLeaderboard({ period: "month" });
    // LEADERBOARD_USER_CONCURRENCY defaults to 5.
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });
});
