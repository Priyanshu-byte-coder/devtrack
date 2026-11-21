/**
 * A board that just dropped out of the Next.js data cache must come back
 * from Redis, not from a rebuild while the visitor waits, and clearing the
 * boards must not wipe every player's saved stats.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheGet: vi.fn(),
  from: vi.fn(),
  scan: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/github-request", () => ({ githubRequest: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ decryptToken: vi.fn(() => null) }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function () {
    return { scan: mocks.scan, del: mocks.del };
  }),
}));

import * as metricsCache from "@/lib/metrics-cache";
import { getLeaderboardData, type LeaderboardPayload } from "@/lib/leaderboard";

function board(ageMinutes: number): LeaderboardPayload {
  return {
    generatedAt: new Date(Date.now() - ageMinutes * 60_000).toISOString(),
    refreshSeconds: 10_800,
    leaders: { streak: [], commits: [], prs: [] },
  } as unknown as LeaderboardPayload;
}

describe("cold leaderboard load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(metricsCache, "cacheGet").mockImplementation(mocks.cacheGet);
    mocks.from.mockImplementation(() => {
      throw new Error("rebuilt the board instead of using the saved one");
    });
  });

  it("serves the fresh board saved in Redis without rebuilding", async () => {
    const saved = board(30);
    mocks.cacheGet.mockResolvedValue(saved);

    const result = await getLeaderboardData(false, { period: "week" });

    expect(result?.generatedAt).toBe(saved.generatedAt);
    expect(mocks.cacheGet).toHaveBeenCalledWith("leaderboard:v1:week");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rebuilds when the saved board is older than the refresh window", async () => {
    mocks.cacheGet.mockResolvedValue(board(4 * 60));

    await getLeaderboardData(false, { period: "month" });

    expect(mocks.from).toHaveBeenCalled();
  });
});

describe("invalidateLeaderboardCache", () => {
  it("drops the cached boards but keeps players' saved stats", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    mocks.scan.mockResolvedValue(["0", ["leaderboard:v1:week"]]);

    await metricsCache.invalidateLeaderboardCache();

    expect(mocks.scan).toHaveBeenCalledWith(0, {
      match: "leaderboard:v1:*",
      count: 100,
    });
    expect(mocks.del).toHaveBeenCalledWith("leaderboard:v1:week");
  });
});
