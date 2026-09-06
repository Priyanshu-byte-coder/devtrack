import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(),
  invalidateLeaderboardCache: vi.fn(),
  revalidateTag: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: never[]) => Promise<unknown>) => fn,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/metrics-cache", () => ({
  cacheSet: mocks.cacheSet,
  cacheGet: mocks.cacheGet,
  invalidateLeaderboardCache: mocks.invalidateLeaderboardCache,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
  isSupabaseAdminAvailable: true,
}));

const USERS = [
  { id: "u1", github_login: "alice", is_sponsor: true },
  { id: "u2", github_login: "bob", is_sponsor: false },
];

const SNAPSHOTS = [
  { user_id: "u1", snapshot_at: "2026-07-03T00:00:00.000Z", commits: 5, prs_merged: 1 },
  { user_id: "u1", snapshot_at: "2026-07-02T00:00:00.000Z", commits: 3, prs_merged: 0 },
  { user_id: "u1", snapshot_at: "2026-06-20T00:00:00.000Z", commits: 10, prs_merged: 2 },
  { user_id: "u2", snapshot_at: "2026-07-03T00:00:00.000Z", commits: 1, prs_merged: 3 },
  { user_id: "u2", snapshot_at: "2026-06-01T00:00:00.000Z", commits: 7, prs_merged: 0 },
];

function makeUsersQuery() {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: USERS, error: null })),
  };

  return chain;
}

function makeSnapshotsQuery() {
  const chain: any = {
    since: null as string | null,
    select: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    gte: vi.fn((_column: string, since: string) => {
      chain.since = since;
      return chain;
    }),
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      const since = chain.since ? new Date(chain.since).getTime() : Number.NEGATIVE_INFINITY;
      const data = SNAPSHOTS.filter((row) => new Date(row.snapshot_at).getTime() >= since);
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };

  return chain;
}

function makeLeaderboardCacheQuery() {
  return {
    upsert: vi.fn(async () => ({ data: null, error: null })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-03T12:00:00.000Z"));

  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return makeUsersQuery();
    }

    if (table === "metric_snapshots") {
      return makeSnapshotsQuery();
    }

    if (table === "leaderboard_cache") {
      return makeLeaderboardCacheQuery();
    }

    throw new Error(`Unexpected table: ${table}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("leaderboard timeframe helpers", () => {
  it("normalizes current and legacy timeframe values", async () => {
    const {
      normalizeLeaderboardTimeframe,
      getLeaderboardCacheKey,
    } = await import("@/lib/leaderboard");

    expect(normalizeLeaderboardTimeframe("weekly")).toBe("weekly");
    expect(normalizeLeaderboardTimeframe("monthly")).toBe("monthly");
    expect(normalizeLeaderboardTimeframe("all_time")).toBe("all_time");
    expect(normalizeLeaderboardTimeframe("week")).toBe("weekly");
    expect(normalizeLeaderboardTimeframe("month")).toBe("monthly");
    expect(normalizeLeaderboardTimeframe("all")).toBe("all_time");
    expect(normalizeLeaderboardTimeframe("invalid")).toBe(null);

    expect(getLeaderboardCacheKey("weekly")).toContain("weekly");
    expect(getLeaderboardCacheKey("monthly")).toContain("monthly");
    expect(getLeaderboardCacheKey("all_time")).toContain("all_time");
    expect(getLeaderboardCacheKey("weekly")).not.toBe(getLeaderboardCacheKey("monthly"));
    expect(getLeaderboardCacheKey("monthly")).not.toBe(getLeaderboardCacheKey("all_time"));
  });

  it("aggregates weekly, monthly, and all-time snapshots from the same dataset", async () => {
    const { buildLeaderboard } = await import("@/lib/leaderboard");

    const weekly = await buildLeaderboard({ timeframe: "weekly" });
    const monthly = await buildLeaderboard({ timeframe: "monthly" });
    const allTime = await buildLeaderboard({ timeframe: "all_time" });

    expect(weekly.leaders.commits[0]).toMatchObject({ username: "alice", commits: 8, prs: 1, streak: 2 });
    expect(weekly.leaders.commits[1]).toMatchObject({ username: "bob", commits: 1, prs: 3, streak: 1 });

    expect(monthly.leaders.commits[0]).toMatchObject({ username: "alice", commits: 18, prs: 3, streak: 2 });
    expect(monthly.leaders.commits[1]).toMatchObject({ username: "bob", commits: 1, prs: 3, streak: 1 });

    expect(allTime.leaders.commits[0]).toMatchObject({ username: "alice", commits: 18, prs: 3, streak: 2 });
    expect(allTime.leaders.commits[1]).toMatchObject({ username: "bob", commits: 8, prs: 3, streak: 1 });

    expect(weekly.leaders.commits[0].score).toBeLessThan(monthly.leaders.commits[0].score);
    expect(monthly.leaders.commits[0].score).toBeLessThanOrEqual(allTime.leaders.commits[0].score);
  });

  it("partitions leaderboard cache writes by timeframe during a shared rebuild", async () => {
    const { refreshAllLeaderboardCaches, getLeaderboardCacheKey } = await import("@/lib/leaderboard");

    await refreshAllLeaderboardCaches();

    expect(mocks.cacheSet).toHaveBeenCalledTimes(3);
    expect(mocks.cacheSet.mock.calls.map(([key]) => key)).toEqual([
      getLeaderboardCacheKey("weekly"),
      getLeaderboardCacheKey("monthly"),
      getLeaderboardCacheKey("all_time"),
    ]);
  });
});
