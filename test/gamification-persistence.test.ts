import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeaderboardEntry, LeaderboardPayload } from "@/lib/leaderboard";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  upserts: [] as Array<{
    table: string;
    rows: Record<string, unknown>[];
    options: unknown;
  }>,
  failTable: null as string | null,
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/leaderboard", () => ({
  refreshLeaderboardCache: mocks.refresh,
}));
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      upsert: async (rows: Record<string, unknown>[], options: unknown) => {
        mocks.upserts.push({ table, rows, options });
        return {
          error: mocks.failTable === table ? { message: "boom" } : null,
        };
      },
    }),
  },
}));

function entry(
  id: string,
  over: Partial<LeaderboardEntry> = {}
): LeaderboardEntry {
  return {
    id,
    rank: 1,
    username: id,
    avatarUrl: "",
    profileUrl: "",
    streak: 3,
    commits: 10,
    prs: 2,
    score: 31,
    isSponsor: false,
    scoreV2: 500,
    tier: "gold",
    activeDays: 5,
    reviews: 1,
    repos: 2,
    ...over,
  };
}

function payload(entries: LeaderboardEntry[]): LeaderboardPayload {
  // Each board holds the same users in a different order.
  return {
    generatedAt: "2026-11-02T00:15:00.000Z",
    refreshSeconds: 3600,
    leaders: { streak: [...entries].reverse(), commits: entries, prs: entries },
  };
}

const tables = (name: string) => mocks.upserts.filter((u) => u.table === name);

describe("rankByScoreV2", () => {
  it("merges the metric boards and ranks by score v2", async () => {
    const { rankByScoreV2 } = await import("@/lib/gamification/persistence");
    const ranked = rankByScoreV2(
      payload([
        entry("a", { scoreV2: 300 }),
        entry("b", { scoreV2: 900 }),
        entry("c", { scoreV2: 600 }),
      ])
    );
    expect(ranked.map((e) => [e.id, e.rankV2])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("breaks score ties with the legacy score", async () => {
    const { rankByScoreV2 } = await import("@/lib/gamification/persistence");
    const ranked = rankByScoreV2(
      payload([
        entry("low", { scoreV2: 500, score: 10 }),
        entry("high", { scoreV2: 500, score: 99 }),
      ])
    );
    expect(ranked[0].id).toBe("high");
  });

  it("skips entries from caches built before score v2", async () => {
    const { rankByScoreV2 } = await import("@/lib/gamification/persistence");
    const ranked = rankByScoreV2(
      payload([
        entry("new"),
        entry("old", { scoreV2: undefined, tier: undefined }),
      ])
    );
    expect(ranked.map((e) => e.id)).toEqual(["new"]);
  });
});

describe("seasonFor", () => {
  it("names seasons by UTC month", async () => {
    const { seasonFor } = await import("@/lib/gamification/persistence");
    expect(seasonFor(new Date("2026-11-30T23:59:59Z"))).toBe("2026-11");
    expect(seasonFor(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01");
  });
});

describe("captureGamification", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.upserts = [];
    mocks.failTable = null;
    mocks.refresh.mockImplementation(async ({ period }: { period: string }) =>
      payload([
        entry("u1", {
          scoreV2: period === "all" ? 800 : 700,
          tier: "platinum",
          xp: 5000,
          level: 14,
        }),
        entry("u2", { scoreV2: 400, tier: "gold", xp: 900, level: 5 }),
      ])
    );
  });

  it("writes one snapshot per user per period for the day", async () => {
    const { captureGamification } =
      await import("@/lib/gamification/persistence");
    const summary = await captureGamification(new Date("2026-11-02T00:15:00Z"));

    expect(summary.snapshots).toEqual({ week: 2, month: 2, all: 2 });
    const snaps = tables("leaderboard_snapshots");
    expect(snaps).toHaveLength(3);
    expect(snaps[0].options).toEqual({
      onConflict: "user_id,period,captured_on",
    });
    expect(snaps[0].rows[0]).toMatchObject({
      user_id: "u1",
      captured_on: "2026-11-02",
      rank: 1,
      score_v2: 700,
      tier: "platinum",
    });
  });

  it("takes XP from the all-time board and tier and rank from the month board", async () => {
    const { captureGamification } =
      await import("@/lib/gamification/persistence");
    await captureGamification(new Date("2026-11-02T00:15:00Z"));

    const [progress] = tables("user_progress");
    expect(progress.options).toEqual({ onConflict: "user_id" });
    expect(progress.rows).toContainEqual({
      user_id: "u2",
      xp: 900,
      level: 5,
      tier: "gold",
      best_tier: "gold",
      best_rank: 2,
    });
  });

  it("does not close a season mid-month", async () => {
    const { captureGamification } =
      await import("@/lib/gamification/persistence");
    const summary = await captureGamification(new Date("2026-11-15T00:15:00Z"));
    expect(summary.seasonClosed).toBeNull();
    expect(tables("season_results")).toHaveLength(0);
  });

  it("closes the previous month's season on the 1st, without overwriting", async () => {
    const { captureGamification } =
      await import("@/lib/gamification/persistence");
    const summary = await captureGamification(new Date("2026-12-01T00:15:00Z"));

    expect(summary.seasonClosed).toBe("2026-11");
    const [season] = tables("season_results");
    expect(season.options).toEqual({
      onConflict: "season,user_id",
      ignoreDuplicates: true,
    });
    expect(season.rows[0]).toMatchObject({
      season: "2026-11",
      user_id: "u1",
      rank: 1,
    });
  });

  it("closes December into the right year", async () => {
    const { captureGamification } =
      await import("@/lib/gamification/persistence");
    const summary = await captureGamification(new Date("2027-01-01T00:15:00Z"));
    expect(summary.seasonClosed).toBe("2026-12");
  });

  it("refreshes cached rank movement and progress once everything is written", async () => {
    mocks.revalidateTag.mockClear();
    const { captureGamification } =
      await import("@/lib/gamification/persistence");
    await captureGamification(new Date("2026-11-02T00:15:00Z"));
    expect(mocks.revalidateTag).toHaveBeenCalledWith("gamification", {
      expire: 0,
    });
  });

  it("fails loudly when a write fails, so the cron reports an error", async () => {
    mocks.failTable = "user_progress";
    const { captureGamification } =
      await import("@/lib/gamification/persistence");
    await expect(
      captureGamification(new Date("2026-11-02T00:15:00Z"))
    ).rejects.toThrow(/Saving progress failed/);
  });
});
