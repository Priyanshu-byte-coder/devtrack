import { describe, expect, it } from "vitest";
import {
  duelPath,
  duelShareText,
  parseDuelSlug,
  scoreDuel,
  type DuelFighter,
} from "@/lib/duel";
import { isValidGitHubUsername } from "@/lib/validate-github-username";

function fighter(
  login: string,
  stats: Partial<DuelFighter["stats"]> = {}
): DuelFighter {
  return {
    login,
    name: null,
    member: false,
    tier: "gold",
    level: 10,
    rank: 3,
    rankEstimated: true,
    topLanguage: "Go",
    stats: {
      score: 500,
      streak: 5,
      longestStreak: 20,
      activeDays: 100,
      contributions: 400,
      commits: 1000,
      prs: 50,
      reviews: 20,
      ...stats,
    },
  };
}

describe("scoreDuel", () => {
  it("awards each round to the bigger number and counts wins", () => {
    const r = scoreDuel(
      fighter("a", { score: 900, streak: 10 }),
      fighter("b", { commits: 5000 })
    );
    expect(r.rounds.find((x) => x.key === "score")?.winner).toBe("left");
    expect(r.rounds.find((x) => x.key === "commits")?.winner).toBe("right");
    expect(r.rounds.find((x) => x.key === "prs")?.winner).toBe("tie");
    expect(r.wins).toEqual({ left: 2, right: 1 });
    expect(r.winner).toBe("left");
    expect(r.flawless).toBe(false);
  });

  it("calls a sweep flawless", () => {
    const r = scoreDuel(fighter("a", { score: 900, streak: 10 }), fighter("b"));
    expect(r.winner).toBe("left");
    expect(r.flawless).toBe(true);
  });

  it("treats hidden stats as no contest", () => {
    const r = scoreDuel(
      fighter("a", { prs: null }),
      fighter("b", { prs: 999 })
    );
    const prs = r.rounds.find((x) => x.key === "prs")!;
    expect(prs.winner).toBeNull();
    expect(prs.leftShare).toBe(0.5);
    expect(r.wins.right).toBe(0);
  });

  it("splits bars by share, evenly at zero", () => {
    const r = scoreDuel(
      fighter("a", { streak: 30, reviews: 0 }),
      fighter("b", { streak: 10, reviews: 0 })
    );
    expect(r.rounds.find((x) => x.key === "streak")?.leftShare).toBe(0.75);
    expect(r.rounds.find((x) => x.key === "reviews")?.leftShare).toBe(0.5);
  });

  it("declares a draw on equal wins", () => {
    const r = scoreDuel(fighter("a"), fighter("b"));
    expect(r.winner).toBeNull();
    expect(duelShareText(fighter("a"), fighter("b"), r)).toContain("draw");
  });
});

describe("duel URLs", () => {
  it("builds lowercase paths", () => {
    expect(duelPath("Octocat", "Torvalds")).toBe(
      "/compare/octocat-vs-torvalds"
    );
  });

  it("parses logins that contain hyphens", () => {
    expect(parseDuelSlug("dev-one-vs-dev-two", isValidGitHubUsername)).toEqual([
      "dev-one",
      "dev-two",
    ]);
  });

  it("rejects the same login twice and junk", () => {
    expect(parseDuelSlug("a-vs-A", isValidGitHubUsername)).toBeNull();
    expect(parseDuelSlug("nope", isValidGitHubUsername)).toBeNull();
    expect(parseDuelSlug("%E0%A4%A", isValidGitHubUsername)).toBeNull();
  });
});

describe("duelShareText", () => {
  it("names the winner and the score", () => {
    const left = fighter("a", { score: 900 });
    const right = fighter("b");
    expect(duelShareText(left, right, scoreDuel(left, right))).toMatch(
      /^@a beats @b 1–0 \(flawless\)|^@a beats @b 1–0/
    );
  });
});
