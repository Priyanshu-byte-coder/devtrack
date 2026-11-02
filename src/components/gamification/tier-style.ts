import type { Tier } from "@/lib/gamification/scoring";

/**
 * Tier colours. Fixed rather than theme tokens: a tier should look the same
 * everywhere it appears, on any theme, like a medal. Each pairs a fill with a
 * text colour that clears WCAG AA on it.
 */
export const TIER_STYLE: Record<
  Tier,
  { label: string; fill: string; text: string; gem: string }
> = {
  bronze: { label: "Bronze", fill: "#8f5426", text: "#fff6ec", gem: "#ffd2a8" },
  silver: { label: "Silver", fill: "#a9b4c4", text: "#0b1020", gem: "#ffffff" },
  gold: { label: "Gold", fill: "#f2c14e", text: "#2a1d00", gem: "#fff4c2" },
  platinum: {
    label: "Platinum",
    fill: "#4fd1c5",
    text: "#032b28",
    gem: "#d6fffb",
  },
  diamond: {
    label: "Diamond",
    fill: "#7aa2ff",
    text: "#061336",
    gem: "#e3ebff",
  },
  legend: { label: "Legend", fill: "#9b30e0", text: "#ffffff", gem: "#ffe1f7" },
};
