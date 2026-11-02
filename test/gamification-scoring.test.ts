import { describe, expect, it } from "vitest";
import {
  absoluteProgress,
  levelFromXp,
  percentile,
  relativeWeight,
  scoreCohort,
  TIER_THRESHOLDS,
  TIERS,
  tierForScore,
  xpForLevel,
  xpFromTotals,
  type ActivityStats,
} from "@/lib/gamification/scoring";

const idle: ActivityStats = {
  activeDays: 0,
  streak: 0,
  commits: 0,
  prs: 0,
  reviews: 0,
  repos: 0,
};
const steady: ActivityStats = {
  activeDays: 6,
  streak: 6,
  commits: 30,
  prs: 6,
  reviews: 4,
  repos: 4,
};
const maxed: ActivityStats = {
  activeDays: 7,
  streak: 30,
  commits: 500,
  prs: 50,
  reviews: 50,
  repos: 20,
};

describe("scoreCohort", () => {
  it("keeps every score within 0..1000", () => {
    const scores = scoreCohort([idle, steady, maxed], "week");
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1000);
    }
  });

  it("gives an idle user 0 and a saturated lone user 1000", () => {
    expect(scoreCohort([idle], "week")).toEqual([0]);
    expect(scoreCohort([maxed], "week")).toEqual([1000]);
  });

  it("orders more active users higher", () => {
    const [a, b, c] = scoreCohort([idle, steady, maxed], "week");
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("returns scores in input order", () => {
    const forward = scoreCohort([idle, maxed], "week");
    const reversed = scoreCohort([maxed, idle], "week");
    expect(forward).toEqual([...reversed].reverse());
  });

  it("makes commit spam pay less and less", () => {
    const withCommits = (commits: number) =>
      scoreCohort([{ ...idle, commits }], "month")[0];
    const first10 = withCommits(10) - withCommits(0);
    const next10 = withCommits(20) - withCommits(10);
    const after100 = withCommits(110) - withCommits(100);
    expect(first10).toBeGreaterThan(next10);
    expect(next10).toBeGreaterThan(after100);
  });

  it("caps any single signal: 10,000 commits alone stays far from the top", () => {
    const spammer = { ...idle, commits: 10_000 };
    // Volume is a quarter of the score; nothing else is earned.
    expect(scoreCohort([spammer], "week")[0]).toBe(250);
  });

  it("rewards a balanced contributor over a commit-only one with more commits", () => {
    const balanced = {
      activeDays: 5,
      streak: 5,
      commits: 20,
      prs: 4,
      reviews: 2,
      repos: 3,
    };
    const commitOnly = { ...idle, commits: 200, activeDays: 2, streak: 1 };
    const [b, c] = scoreCohort([balanced, commitOnly], "week");
    expect(b).toBeGreaterThan(c);
  });

  it("treats bad inputs as zero rather than producing NaN", () => {
    const broken = { ...idle, commits: Number.NaN, prs: -5, repos: Infinity };
    expect(scoreCohort([broken], "week")).toEqual([0]);
  });

  it("scales targets by period: the same week of work scores lower on the all-time board", () => {
    expect(scoreCohort([steady], "week")[0]).toBeGreaterThan(
      scoreCohort([steady], "all")[0]
    );
  });
});

describe("relative weighting", () => {
  it("ignores percentile for a lone user and caps it at half", () => {
    expect(relativeWeight(1)).toBe(0);
    expect(relativeWeight(2)).toBeGreaterThan(0);
    expect(relativeWeight(21)).toBe(0.5);
    expect(relativeWeight(500)).toBe(0.5);
  });

  it("computes percentile with ties counted as half", () => {
    expect(percentile(5, [1, 5, 9])).toBe(0.5);
    expect(percentile(9, [1, 5, 9])).toBe(1);
    expect(percentile(1, [1, 5, 9])).toBe(0);
    expect(percentile(3, [3, 3, 3])).toBe(0.5);
  });

  it("log progress saturates at the target", () => {
    expect(absoluteProgress(0, 10)).toBe(0);
    expect(absoluteProgress(10, 10)).toBe(1);
    expect(absoluteProgress(1000, 10)).toBe(1);
    expect(absoluteProgress(5, 0)).toBe(0);
  });
});

describe("tiers", () => {
  it("maps each threshold to its own tier", () => {
    for (const tier of TIERS)
      expect(tierForScore(TIER_THRESHOLDS[tier])).toBe(tier);
  });

  it("stays in the lower tier one point below a threshold", () => {
    expect(tierForScore(TIER_THRESHOLDS.gold - 1)).toBe("silver");
    expect(tierForScore(TIER_THRESHOLDS.legend - 1)).toBe("diamond");
  });

  it("covers the full score range", () => {
    expect(tierForScore(0)).toBe("bronze");
    expect(tierForScore(1000)).toBe("legend");
  });
});

describe("XP and levels", () => {
  it("weights PRs and reviews above commits", () => {
    expect(xpFromTotals({ commits: 1, prs: 0, reviews: 0 })).toBe(10);
    expect(xpFromTotals({ commits: 0, prs: 1, reviews: 0 })).toBe(40);
    expect(xpFromTotals({ commits: 0, prs: 0, reviews: 1 })).toBe(15);
  });

  it("starts everyone at level 1", () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, current: 0 });
  });

  it("levels up exactly at each boundary", () => {
    for (const level of [2, 3, 5, 10, 25, 60]) {
      const at = xpForLevel(level);
      expect(levelFromXp(at).level).toBe(level);
      expect(levelFromXp(at - 1).level).toBe(level - 1);
    }
  });

  it("makes each level take longer than the last", () => {
    const span = (l: number) => xpForLevel(l + 1) - xpForLevel(l);
    expect(span(2)).toBeGreaterThan(span(1));
    expect(span(10)).toBeGreaterThan(span(9));
  });

  it("reports progress toward the next level", () => {
    const p = levelFromXp(xpForLevel(4) + 10);
    expect(p.level).toBe(4);
    expect(p.current).toBe(10);
    expect(p.fraction).toBeGreaterThan(0);
    expect(p.fraction).toBeLessThan(1);
  });

  it("is monotonic: more XP never means a lower level", () => {
    let last = 1;
    for (let xp = 0; xp <= 50_000; xp += 37) {
      const { level } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });
});
