import { describe, expect, it } from "vitest";
import { rankEntriesByScoreV2, rankMovement } from "@/lib/gamification/ranking";
import type { LeaderboardEntry } from "@/lib/leaderboard";

const e = (
  id: string,
  scoreV2: number | undefined,
  score = 0
): LeaderboardEntry => ({
  id,
  rank: 0,
  username: id,
  avatarUrl: "",
  profileUrl: "",
  streak: 0,
  commits: 0,
  prs: 0,
  score,
  isSponsor: false,
  scoreV2,
  tier: scoreV2 === undefined ? undefined : "gold",
});

describe("rankEntriesByScoreV2", () => {
  it("dedupes users who appear on several boards", () => {
    const ranked = rankEntriesByScoreV2([
      e("a", 500),
      e("b", 700),
      e("a", 500),
    ]);
    expect(ranked.map((r) => [r.id, r.rankV2])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("breaks ties by legacy score, then by name, so order is stable", () => {
    const ranked = rankEntriesByScoreV2([
      e("zed", 500, 1),
      e("amy", 500, 1),
      e("max", 500, 9),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["max", "amy", "zed"]);
  });
});

describe("rankMovement", () => {
  it("shows nothing on the very first day", () => {
    expect(rankMovement(3, undefined, false)).toEqual({ kind: "none" });
  });

  it("marks people missing from the baseline as new", () => {
    expect(rankMovement(3, undefined, true)).toEqual({ kind: "new" });
  });

  it("counts places moved", () => {
    expect(rankMovement(2, 5, true)).toEqual({ kind: "up", places: 3 });
    expect(rankMovement(5, 2, true)).toEqual({ kind: "down", places: 3 });
    expect(rankMovement(4, 4, true)).toEqual({ kind: "same" });
  });
});
