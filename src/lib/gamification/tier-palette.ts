import type { Tier } from "@/lib/gamification/scoring";

/**
 * Tier colours. Fixed rather than theme tokens: a tier should look the same
 * everywhere it appears, on any theme, like a medal.
 *
 * - `fill` with `text`: the badge chip; text clears WCAG AA on the fill.
 * - `gem`: the gem's highlight pixels.
 * - `accent`: the tier colour for text and bars on dark panels (README badge,
 *   share cards); clears AA (6.8:1 or better) on #0b1020.
 */
export const TIER_STYLE: Record<
  Tier,
  { label: string; fill: string; text: string; gem: string; accent: string }
> = {
  bronze: {
    label: "Bronze",
    fill: "#8f5426",
    text: "#fff6ec",
    gem: "#ffd2a8",
    accent: "#d9955c",
  },
  silver: {
    label: "Silver",
    fill: "#a9b4c4",
    text: "#0b1020",
    gem: "#ffffff",
    accent: "#a9b4c4",
  },
  gold: {
    label: "Gold",
    fill: "#f2c14e",
    text: "#2a1d00",
    gem: "#fff4c2",
    accent: "#f2c14e",
  },
  platinum: {
    label: "Platinum",
    fill: "#4fd1c5",
    text: "#032b28",
    gem: "#d6fffb",
    accent: "#4fd1c5",
  },
  diamond: {
    label: "Diamond",
    fill: "#7aa2ff",
    text: "#061336",
    gem: "#e3ebff",
    accent: "#7aa2ff",
  },
  legend: {
    label: "Legend",
    fill: "#9b30e0",
    text: "#ffffff",
    gem: "#ffe1f7",
    accent: "#c77dff",
  },
};
