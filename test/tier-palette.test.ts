import { describe, expect, it } from "vitest";
import { TIER_STYLE } from "@/lib/gamification/tier-palette";

describe("TIER_STYLE", () => {
  it("defines the label and all four color roles for every tier", () => {
    expect(Object.keys(TIER_STYLE)).toEqual([
      "bronze",
      "silver",
      "gold",
      "platinum",
      "diamond",
      "legend",
    ]);
    for (const [tier, style] of Object.entries(TIER_STYLE)) {
      expect(style.label.toLowerCase()).toBe(tier);
      for (const color of [style.fill, style.text, style.gem, style.accent]) {
        expect(color).toMatch(/^#[\da-f]{6}$/i);
      }
    }
  });

  it.each([
    ["bronze", "Bronze", "#8f5426", "#fff6ec", "#ffd2a8", "#d9955c"],
    ["silver", "Silver", "#a9b4c4", "#0b1020", "#ffffff", "#a9b4c4"],
    ["gold", "Gold", "#f2c14e", "#2a1d00", "#fff4c2", "#f2c14e"],
    ["platinum", "Platinum", "#4fd1c5", "#032b28", "#d6fffb", "#4fd1c5"],
    ["diamond", "Diamond", "#7aa2ff", "#061336", "#e3ebff", "#7aa2ff"],
    ["legend", "Legend", "#9b30e0", "#ffffff", "#ffe1f7", "#c77dff"],
  ] as const)(
    "keeps %s palette stable",
    (tier, label, fill, text, gem, accent) => {
      expect(TIER_STYLE[tier]).toEqual({ label, fill, text, gem, accent });
    }
  );
});
