/**
 * A failed GitHub lookup must not sink a player's rank. The search fallback
 * has no active days, streak, reviews or repositories, so falling back to it
 * dropped a near-top player ~400 points whenever their token was briefly
 * rate limited.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  githubRequest: vi.fn(),
  store: new Map<string, unknown>(),
}));

vi.mock("@/lib/github-request", () => ({ githubRequest: mocks.githubRequest }));
vi.mock("@/lib/crypto", () => ({ decryptToken: vi.fn(() => "user-token") }));
vi.mock("@/lib/metrics-cache", () => ({
  cacheGet: vi.fn(async (key: string) => mocks.store.get(key) ?? null),
  cacheGetMany: vi.fn(async (keys: string[]) =>
    keys.map((key) => mocks.store.get(key) ?? null)
  ),
  cacheSet: vi.fn(async (key: string, value: unknown) => {
    mocks.store.set(key, value);
  }),
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
        ? {
            data: [{ id: "u1", github_login: "brijesh", is_sponsor: false }],
            error: null,
          }
        : {
            data: [{ user_id: "u1", encrypted_token: "x", token_iv: "y" }],
            error: null,
          };
    for (const m of ["select", "eq", "in", "order"]) chain[m] = () => chain;
    chain.limit = () => Promise.resolve(result);
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  };
  return { supabaseAdmin: { from: query } };
});

const day = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function contributions() {
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
                  contributionDays: Array.from({ length: 20 }, (_, i) => ({
                    date: day(i),
                    contributionCount: 2,
                  })),
                },
              ],
            },
          },
          period: {
            totalCommitContributions: 120,
            totalPullRequestContributions: 30,
            totalPullRequestReviewContributions: 40,
            totalRepositoriesWithContributedCommits: 9,
          },
        },
      },
    }),
  };
}

const failed = { ok: false, status: 429, json: async () => ({}) };
const searchCount = {
  ok: true,
  json: async () => ({ total_count: 100 }),
};

function auth(init?: { headers?: Record<string, string> }) {
  return init?.headers?.Authorization ?? "";
}

describe("leaderboard player stats when GitHub fails", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.store.clear();
    mocks.githubRequest.mockReset();
    process.env.GITHUB_TOKEN = "shared-token";
  });

  it("retries with the shared token before giving up", async () => {
    mocks.githubRequest.mockImplementation(async (url: string, init) =>
      String(url).includes("/graphql")
        ? auth(init).includes("user-token")
          ? failed
          : contributions()
        : searchCount
    );
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const [entry] = (await buildLeaderboard({ period: "month" })).leaders
      .commits;
    expect(entry).toMatchObject({ activeDays: 20, reviews: 40, repos: 9 });
  });

  it("keeps the last good stats when every lookup fails", async () => {
    // A good build first...
    mocks.githubRequest.mockImplementation(async (url: string) =>
      String(url).includes("/graphql") ? contributions() : searchCount
    );
    let { buildLeaderboard } = await import("@/lib/leaderboard");
    const good = (await buildLeaderboard({ period: "month" })).leaders
      .commits[0];

    // ...then GitHub fails for both tokens.
    vi.resetModules();
    mocks.githubRequest.mockImplementation(async (url: string) =>
      String(url).includes("/graphql") ? failed : searchCount
    );
    ({ buildLeaderboard } = await import("@/lib/leaderboard"));
    const after = (await buildLeaderboard({ period: "month" })).leaders
      .commits[0];

    expect(after).toMatchObject({
      activeDays: good.activeDays,
      reviews: good.reviews,
      repos: good.repos,
      scoreV2: good.scoreV2,
    });
  });

  it("serves fresh saved stats without calling GitHub, even after a deploy", async () => {
    mocks.store.set("leaderboard:player:last-good:month:brijesh", {
      stats: {
        streak: 3,
        commits: 50,
        prs: 9,
        activeDays: 12,
        reviews: 4,
        repos: 5,
      },
      savedAt: Date.now(),
    });
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const [entry] = (await buildLeaderboard({ period: "month" })).leaders
      .commits;
    expect(entry).toMatchObject({ activeDays: 12, reviews: 4, repos: 5 });
    expect(
      mocks.githubRequest.mock.calls.filter(([url]) =>
        String(url).includes("/graphql")
      )
    ).toHaveLength(0);
  });

  it("reads every player's saved stats in one Redis command", async () => {
    const { cacheGet, cacheGetMany } = await import("@/lib/metrics-cache");
    vi.mocked(cacheGet).mockClear();
    vi.mocked(cacheGetMany).mockClear();
    mocks.store.set("leaderboard:player:last-good:month:brijesh", {
      stats: {
        streak: 3,
        commits: 50,
        prs: 9,
        activeDays: 12,
        reviews: 4,
        repos: 5,
      },
      savedAt: Date.now(),
    });
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    await buildLeaderboard({ period: "month" });
    expect(cacheGetMany).toHaveBeenCalledTimes(1);
    expect(cacheGetMany).toHaveBeenCalledWith([
      "leaderboard:player:last-good:month:brijesh",
    ]);
    expect(
      vi
        .mocked(cacheGet)
        .mock.calls.filter(([key]) => String(key).includes("last-good"))
    ).toHaveLength(0);
  });

  it("refreshes stale saved stats and keeps them if the refresh fails", async () => {
    mocks.store.set("leaderboard:player:last-good:month:brijesh", {
      stats: {
        streak: 3,
        commits: 50,
        prs: 9,
        activeDays: 12,
        reviews: 4,
        repos: 5,
      },
      savedAt: Date.now() - 8 * 60 * 60 * 1000,
    });
    mocks.githubRequest.mockImplementation(async (url: string) =>
      String(url).includes("/graphql") ? failed : searchCount
    );
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const [entry] = (await buildLeaderboard({ period: "month" })).leaders
      .commits;
    expect(mocks.githubRequest).toHaveBeenCalled();
    expect(entry).toMatchObject({ activeDays: 12, reviews: 4, repos: 5 });
  });

  it("keeps saved lifetime totals when the all-time lookup fails", async () => {
    // The year's data loads but the per-year lifetime totals time out.
    mocks.store.set("leaderboard:player:last-good:all:brijesh", {
      stats: {
        streak: 3,
        commits: 1190,
        prs: 10,
        activeDays: 96,
        reviews: 0,
        repos: 19,
      },
      savedAt: Date.now() - 8 * 60 * 60 * 1000,
    });
    mocks.githubRequest.mockImplementation(
      async (url: string, init?: { body?: string }) =>
        String(url).includes("/graphql")
          ? String(init?.body).includes("LeaderboardAllTime")
            ? failed
            : contributions()
          : searchCount
    );
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const [entry] = (await buildLeaderboard({ period: "all" })).leaders.commits;
    // Not the last year's 120 commits passed off as lifetime.
    expect(entry).toMatchObject({ commits: 1190, prs: 10 });
  });

  it("sums every year for all-time totals when the lookup works", async () => {
    mocks.githubRequest.mockImplementation(
      async (url: string, init?: { body?: string }) =>
        String(url).includes("/graphql")
          ? String(init?.body).includes("LeaderboardAllTime")
            ? {
                ok: true,
                json: async () => ({
                  data: {
                    user: {
                      y2025: {
                        totalCommitContributions: 900,
                        totalPullRequestContributions: 5,
                        totalPullRequestReviewContributions: 1,
                      },
                      y2026: {
                        totalCommitContributions: 120,
                        totalPullRequestContributions: 30,
                        totalPullRequestReviewContributions: 40,
                      },
                    },
                  },
                }),
              }
            : contributions()
          : searchCount
    );
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const [entry] = (await buildLeaderboard({ period: "all" })).leaders.commits;
    expect(entry).toMatchObject({ commits: 1020, prs: 35, reviews: 41 });
  });

  it("only uses the search counts for a player never loaded before", async () => {
    mocks.githubRequest.mockImplementation(async (url: string) =>
      String(url).includes("/graphql") ? failed : searchCount
    );
    const { buildLeaderboard } = await import("@/lib/leaderboard");
    const [entry] = (await buildLeaderboard({ period: "month" })).leaders
      .commits;
    expect(entry).toMatchObject({ commits: 100, activeDays: 0, reviews: 0 });
  });
});
