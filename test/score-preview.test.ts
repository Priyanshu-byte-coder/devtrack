import { describe, it, expect } from "vitest";
import type { ScorePreview } from "@/lib/score-preview";

describe("ScorePreview", () => {
  it("supports a complete score preview with nullable fields", () => {
    const preview = {
      login: "octocat",
      name: null,
      member: false,
      tier: null,
      level: 1,
      rank: null,
      rankEstimated: false,
      players: 0,
      streak: null,
      contributions: null,
      prs: null,
      topLanguage: null,
    } satisfies ScorePreview;

    expect(preview.login).toBe("octocat");
    expect(preview.name).toBeNull();
    expect(preview.rank).toBeNull();
    expect(preview.topLanguage).toBeNull();
  });

  it("supports populated score and ranking data", () => {
    const preview = {
      login: "octocat",
      name: "The Octocat",
      member: true,
      tier: "gold",
      level: 12,
      rank: 42,
      rankEstimated: true,
      players: 1000,
      streak: 7,
      contributions: 250,
      prs: 15,
      topLanguage: "TypeScript",
    } satisfies ScorePreview;

    expect(preview.member).toBe(true);
    expect(preview.level).toBe(12);
    expect(preview.rank).toBe(42);
    expect(preview.contributions).toBe(250);
  });
});
