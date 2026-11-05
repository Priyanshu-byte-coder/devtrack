import { beforeEach, describe, expect, it, vi } from "vitest";

const getRankBadgeRow = vi.fn();
const getLeaderboardData = vi.fn();

vi.mock("@/lib/gamification/queries", () => ({
  getRankBadgeRow: (...args: unknown[]) => getRankBadgeRow(...args),
}));
vi.mock("@/lib/leaderboard", () => ({
  getLeaderboardData: (...args: unknown[]) => getLeaderboardData(...args),
}));

import { getRankRow } from "@/lib/gamification/live-rank";

function entry(id: string, username: string, scoreV2: number) {
  return {
    id,
    username,
    scoreV2,
    tier: "gold",
    score: scoreV2,
    streak: 3,
    commits: 40,
    prs: 5,
  };
}

const board = {
  leaders: {
    // The same player appears in several lists; they must count once.
    streak: [entry("a", "Alice", 700), entry("b", "NewDev", 500)],
    commits: [entry("b", "NewDev", 500), entry("c", "carol", 300)],
  },
};

const snapshotRow = {
  rank: 4,
  total: 20,
  tier: "silver",
  scoreV2: 410,
  previousRank: 6,
  hasPrevious: true,
  level: 9,
  xp: 1200,
  streak: 2,
  commits: 30,
  prs: 1,
};

describe("getRankRow", () => {
  beforeEach(() => {
    getRankBadgeRow.mockReset();
    getLeaderboardData.mockReset();
  });

  it("uses the daily snapshot when there is one", async () => {
    getRankBadgeRow.mockResolvedValue(snapshotRow);
    await expect(getRankRow("someone", "all")).resolves.toBe(snapshotRow);
    expect(getLeaderboardData).not.toHaveBeenCalled();
  });

  it("falls back to the live board for players who joined today", async () => {
    getRankBadgeRow.mockResolvedValue(null);
    getLeaderboardData.mockResolvedValue(board);

    await expect(getRankRow("newdev", "all")).resolves.toEqual({
      rank: 2,
      total: 3,
      tier: "gold",
      scoreV2: 500,
      previousRank: null,
      hasPrevious: false,
      level: null,
      xp: null,
      streak: 3,
      commits: 40,
      prs: 5,
    });
    expect(getLeaderboardData).toHaveBeenCalledWith(false, { period: "all" });
  });

  it("stays unranked for logins that aren't on the board", async () => {
    getRankBadgeRow.mockResolvedValue(null);
    getLeaderboardData.mockResolvedValue(board);
    await expect(getRankRow("private-person", "all")).resolves.toBeNull();
  });

  it("stays unranked when the board can't be loaded", async () => {
    getRankBadgeRow.mockResolvedValue(null);
    getLeaderboardData.mockRejectedValue(new Error("GitHub busy"));
    await expect(getRankRow("newdev", "all")).resolves.toBeNull();
  });
});
