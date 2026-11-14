import { describe, expect, it } from "vitest";
import {
  authorWeeks,
  buildDiffTrendWeeks,
  DIFF_TREND_WEEKS,
  diffTrendWeekStarts,
  lacksLineCounts,
  topCommitRepos,
  weekEndingLabel,
} from "@/lib/diff-trend";

const DAY = 24 * 60 * 60;
const iso = (seconds: number) =>
  new Date(seconds * 1000).toISOString().slice(0, 10);

describe("diffTrendWeekStarts", () => {
  it("returns 12 Sunday-aligned weeks ending with the current one", () => {
    // Friday afternoon UTC.
    const starts = diffTrendWeekStarts(new Date("2026-11-13T15:30:00Z"));

    expect(starts).toHaveLength(DIFF_TREND_WEEKS);
    expect(iso(starts.at(-1)!)).toBe("2026-11-08");
    expect(iso(starts[0])).toBe("2026-08-23");
    for (const start of starts) {
      expect(new Date(start * 1000).getUTCDay()).toBe(0);
      expect(start % DAY).toBe(0);
    }
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBe(7 * DAY);
    }
  });

  it("treats a Sunday as the start of the current week", () => {
    const starts = diffTrendWeekStarts(new Date("2026-11-15T00:00:00Z"), 2);
    expect(starts.map(iso)).toEqual(["2026-11-08", "2026-11-15"]);
  });
});

describe("topCommitRepos", () => {
  const commit = (full_name: string) => ({ repository: { full_name } });

  it("ranks repositories by commit count and keeps the top three", () => {
    const items = [
      commit("me/b"),
      commit("me/a"),
      commit("me/c"),
      commit("me/a"),
      commit("me/d"),
      commit("me/a"),
      commit("me/c"),
      { repository: undefined },
    ];
    expect(topCommitRepos(items)).toEqual(["me/a", "me/c", "me/b"]);
  });

  it("breaks ties by name so the choice is stable", () => {
    expect(topCommitRepos([commit("me/z"), commit("me/y")], 1)).toEqual([
      "me/y",
    ]);
  });
});

describe("authorWeeks", () => {
  const weeks = [{ w: 0, a: 1, d: 2, c: 1 }];

  it("matches the login case-insensitively", () => {
    const stats = [
      { author: null, weeks: [] },
      { author: { login: "Someone" }, weeks: [] },
      { author: { login: "OctoCat" }, weeks },
    ];
    expect(authorWeeks(stats, "octocat")).toBe(weeks);
  });

  it("returns null when the user is not among the listed contributors", () => {
    expect(authorWeeks([{ author: { login: "x" }, weeks }], "me")).toBeNull();
  });
});

describe("lacksLineCounts", () => {
  const window = [100, 200];

  it("flags commits without any line counts in the window", () => {
    expect(
      lacksLineCounts(
        [
          { w: 0, a: 50, d: 5, c: 1 },
          { w: 100, a: 0, d: 0, c: 3 },
        ],
        window
      )
    ).toBe(true);
  });

  it("accepts weeks with line counts and windows without commits", () => {
    expect(lacksLineCounts([{ w: 200, a: 0, d: 4, c: 1 }], window)).toBe(false);
    expect(lacksLineCounts([{ w: 100, a: 0, d: 0, c: 0 }], window)).toBe(false);
  });
});

describe("buildDiffTrendWeeks", () => {
  it("sums repositories per week and ignores weeks outside the window", () => {
    const starts = diffTrendWeekStarts(new Date("2026-11-13T00:00:00Z"), 2);
    const [previous, current] = starts;

    expect(
      buildDiffTrendWeeks(starts, [
        [
          { w: previous - 7 * DAY, a: 999, d: 999, c: 9 },
          { w: previous, a: 10, d: 2, c: 1 },
          { w: current, a: 5, d: 1, c: 1 },
        ],
        [{ w: current, a: 20, d: 30, c: 2 }],
      ])
    ).toEqual([
      { weekStart: "2026-11-01", additions: 10, deletions: 2 },
      { weekStart: "2026-11-08", additions: 25, deletions: 31 },
    ]);
  });

  it("returns zeroed weeks when there is nothing to count", () => {
    const starts = diffTrendWeekStarts(new Date("2026-11-13T00:00:00Z"), 1);
    expect(buildDiffTrendWeeks(starts, [])).toEqual([
      { weekStart: "2026-11-08", additions: 0, deletions: 0 },
    ]);
  });
});

describe("weekEndingLabel", () => {
  it("labels a week by its Saturday", () => {
    expect(weekEndingLabel("2026-11-08")).toBe("Nov 14");
    expect(weekEndingLabel("2026-12-27")).toBe("Jan 2");
  });
});
