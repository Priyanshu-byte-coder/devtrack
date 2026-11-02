import { describe, expect, it } from "vitest";
import {
  lastSevenDays,
  renderCommitsBadge,
  renderStreakBadge,
} from "@/lib/gamification/stat-badge";

function title(svg: string) {
  return svg.match(/<title>(.*?)<\/title>/)?.[1];
}

describe("renderStreakBadge", () => {
  const week = [true, true, false, true, true, true, true];

  it("describes the streak for screen readers", () => {
    const svg = renderStreakBadge({
      state: "ok",
      current: 12,
      longest: 40,
      lowerBound: false,
      lastWeek: week,
    });
    expect(svg).toMatch(/^<svg [^>]*role="img"/);
    expect(title(svg)).toBe("DevTrack: 12-day streak, best 40 days");
  });

  it("marks capped history as a lower bound", () => {
    const svg = renderStreakBadge({
      state: "ok",
      current: 1,
      longest: 1,
      lowerBound: true,
      lastWeek: week,
    });
    expect(title(svg)).toBe("DevTrack: 1+-day streak, best 1+ day");
  });

  it("lights one cell per active day of the last week", () => {
    const svg = renderStreakBadge({
      state: "ok",
      current: 4,
      longest: 9,
      lowerBound: false,
      lastWeek: week,
    });
    expect(svg.match(/fill="#ff7a1a"><animate/g)).toHaveLength(6);
  });

  it("goes cold and still at zero", () => {
    const svg = renderStreakBadge({
      state: "ok",
      current: 0,
      longest: 9,
      lowerBound: false,
      lastWeek: Array(7).fill(false),
    });
    expect(svg).not.toContain("#ff7a1a");
    expect(svg).not.toContain("<animate");
  });

  it("has syncing and error states", () => {
    expect(title(renderStreakBadge({ state: "syncing" }))).toContain("syncing");
    expect(title(renderStreakBadge({ state: "error" }))).toContain(
      "unavailable"
    );
  });

  it("only uses finite animations", () => {
    const svg = renderStreakBadge({
      state: "ok",
      current: 30,
      longest: 30,
      lowerBound: false,
      lastWeek: week,
    });
    expect(svg).not.toContain("indefinite");
  });
});

describe("renderCommitsBadge", () => {
  it("names the count and month", () => {
    const svg = renderCommitsBadge({
      state: "ok",
      commits: 1234,
      month: 10,
      year: 2026,
      monthProgress: 0.1,
    });
    expect(title(svg)).toBe("DevTrack: 1,234 commits in Nov 2026");
    expect(svg).not.toContain("indefinite");
  });

  it("uses the singular for one commit", () => {
    const svg = renderCommitsBadge({
      state: "ok",
      commits: 1,
      month: 0,
      year: 2027,
      monthProgress: 1,
    });
    expect(title(svg)).toBe("DevTrack: 1 commit in Jan 2027");
  });

  it("has an error state", () => {
    expect(title(renderCommitsBadge({ state: "error" }))).toContain(
      "unavailable"
    );
  });
});

describe("lastSevenDays", () => {
  it("ends today and crosses month boundaries", () => {
    expect(lastSevenDays("2026-11-03")).toEqual([
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });
});
