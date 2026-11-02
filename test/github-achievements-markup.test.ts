/**
 * GitHub's profile sidebar markup for achievements changed: the <img> used to
 * open with alt="" aria-hidden="true" and now leads with src. The parser must
 * find achievements in both, and in any attribute order.
 */

import { describe, expect, it } from "vitest";
import { parseAchievementsFromProfileHtml } from "../src/lib/github-achievements";

const PROFILE = "https://github.com/octocat";

// Captured from github.com profile HTML in November 2026 (login swapped).
const CURRENT_MARKUP = `
<div class="d-flex flex-wrap">
<img src="https://github.githubassets.com/assets/pull-shark-bronze-a37accb528d1.png" data-hovercard-type="achievement" data-hovercard-url="/users/octocat/achievements/pull-shark/detail?hovercard=1" width="64" alt="Achievement: Pull Shark" data-view-component="true" class="achievement-badge-sidebar" />
<img src="https://github.githubassets.com/assets/starstruck-bronze-b71ec4d7766a.png" data-hovercard-type="achievement" data-hovercard-url="/users/octocat/achievements/starstruck/detail?hovercard=1" width="64" alt="Achievement: Starstruck" data-view-component="true" class="achievement-badge-sidebar" />
<img src="https://github.githubassets.com/assets/pair-extraordinaire-default-579438a20e01.png" data-hovercard-type="achievement" data-hovercard-url="/users/octocat/achievements/pair-extraordinaire/detail?hovercard=1" width="64" alt="Achievement: Pair Extraordinaire" data-view-component="true" class="achievement-badge-sidebar" />
</div>`;

const LEGACY_MARKUP = `<img alt="" aria-hidden="true" alt="Achievement: Quickdraw" src="https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png" data-hovercard-url="/users/octocat/achievements/quickdraw/detail?hovercard=1" />`;

describe("parseAchievementsFromProfileHtml", () => {
  it("parses GitHub's current achievement markup", () => {
    const result = parseAchievementsFromProfileHtml(CURRENT_MARKUP, PROFILE);
    expect(result.map((a) => a.slug)).toEqual([
      "pair-extraordinaire",
      "pull-shark",
      "starstruck",
    ]);
    const shark = result.find((a) => a.slug === "pull-shark")!;
    expect(shark.title).toBe("Pull Shark");
    expect(shark.imageUrl).toBe(
      "https://github.githubassets.com/assets/pull-shark-bronze-a37accb528d1.png"
    );
    expect(shark.url).toContain("achievement=pull-shark");
  });

  it("still parses the older markup", () => {
    const result = parseAchievementsFromProfileHtml(LEGACY_MARKUP, PROFILE);
    expect(result.map((a) => a.slug)).toEqual(["quickdraw"]);
  });

  it("ignores ordinary images", () => {
    const html = `<img src="/avatar.png" alt="@octocat" /><img alt="" src="/x.png" />`;
    expect(parseAchievementsFromProfileHtml(html, PROFILE)).toEqual([]);
  });

  it("counts each achievement once even if it appears twice", () => {
    expect(
      parseAchievementsFromProfileHtml(CURRENT_MARKUP + CURRENT_MARKUP, PROFILE)
    ).toHaveLength(3);
  });
});
