import { describe, expect, it } from "vitest";
import {
  applyLeaderboardQuery,
  getRangeStartDate,
  parseLeaderboardQueryFromSearchParams,
  type LeaderboardEntry,
} from "@/lib/leaderboard-query";

function makeEntry(
  username: string,
  streak: number,
  commits: number,
  prs: number,
  score: number
): LeaderboardEntry {
  return {
    rank: 0,
    username,
    avatarUrl: `https://example.com/${username}.png`,
    profileUrl: `/u/${username}`,
    streak,
    commits,
    prs,
    score,
  };
}

describe("parseLeaderboardQueryFromSearchParams", () => {
  it("parses valid query values", () => {
    const params = new URLSearchParams({
      page: "2",
      limit: "50",
      sort: "commits",
      range: "90d",
      scope: "organizations",
    });

    expect(parseLeaderboardQueryFromSearchParams(params)).toEqual({
      page: 2,
      limit: 50,
      sort: "commits",
      range: "90d",
      scope: "organizations",
    });
  });

  it("falls back to defaults for invalid query values", () => {
    const params = new URLSearchParams({
      page: "0",
      limit: "5",
      sort: "bogus",
      range: "bogus",
      scope: "bogus",
    });

    expect(parseLeaderboardQueryFromSearchParams(params)).toEqual({
      page: 1,
      limit: 25,
      sort: "score",
      range: "30d",
      scope: "global",
    });
  });
});

describe("applyLeaderboardQuery", () => {
  const entries = [
    makeEntry("alpha", 9, 40, 6, 103),
    makeEntry("beta", 4, 80, 3, 109),
    makeEntry("charlie", 12, 30, 2, 96),
    makeEntry("delta", 7, 20, 8, 79),
  ];

  it("sorts by score and paginates", () => {
    const result = applyLeaderboardQuery(entries, {
      page: 1,
      limit: 2,
      sort: "score",
      range: "30d",
      scope: "global",
    });

    expect(result.items.map((entry) => entry.username)).toEqual(["beta", "alpha"]);
    expect(result.items.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(result.pagination.total).toBe(4);
    expect(result.pagination.totalPages).toBe(2);
  });

  it("clamps page to total pages", () => {
    const result = applyLeaderboardQuery(entries, {
      page: 10,
      limit: 3,
      sort: "streak",
      range: "30d",
      scope: "global",
    });

    expect(result.pagination.page).toBe(2);
    expect(result.items.length).toBe(1);
    expect(result.items[0].rank).toBe(4);
  });
});

describe("getRangeStartDate", () => {
  const now = new Date("2026-07-02T00:00:00.000Z");

  it("returns expected 7 day start", () => {
    expect(getRangeStartDate("7d", now)).toBe("2026-06-25");
  });

  it("returns expected all-time start", () => {
    expect(getRangeStartDate("all", now)).toBe("2008-01-01");
  });
});
