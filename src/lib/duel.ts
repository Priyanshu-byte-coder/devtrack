/**
 * Compare duels: two developers, round by round. Pure, so the page and the
 * share card score a duel the same way.
 */

import type { Tier } from "@/lib/gamification/scoring";

export type DuelStatKey =
  | "score"
  | "streak"
  | "longestStreak"
  | "activeDays"
  | "contributions"
  | "commits"
  | "prs"
  | "reviews";

/** One fighter. A null stat is hidden by its owner and sits the round out. */
export interface DuelFighter {
  login: string;
  name: string | null;
  /** On DevTrack (real rank) or not (estimated). */
  member: boolean;
  /** Null for members who haven't joined the leaderboard. */
  tier: Tier | null;
  level: number;
  /** Global rank, real or estimated; null when unknown. */
  rank: number | null;
  rankEstimated: boolean;
  topLanguage: string | null;
  stats: Record<DuelStatKey, number | null>;
}

export const ROUNDS: Array<{ key: DuelStatKey; label: string; unit?: string }> =
  [
    { key: "score", label: "DevTrack score" },
    { key: "streak", label: "Current streak", unit: "d" },
    { key: "longestStreak", label: "Best streak (1y)", unit: "d" },
    { key: "activeDays", label: "Active days (1y)" },
    { key: "contributions", label: "Contributions (1y)" },
    { key: "commits", label: "Commits (all time)" },
    { key: "prs", label: "Pull requests" },
    { key: "reviews", label: "Code reviews" },
  ];

export type Side = "left" | "right";

export interface DuelRound {
  key: DuelStatKey;
  label: string;
  unit?: string;
  left: number | null;
  right: number | null;
  /** null when either side is hidden: no contest. */
  winner: Side | "tie" | null;
  /** Left's share of the bar, 0..1 (0.5 for ties, empty and no contest). */
  leftShare: number;
}

export interface DuelResult {
  rounds: DuelRound[];
  wins: Record<Side, number>;
  /** null for a draw. */
  winner: Side | null;
  /** Won every contested round. */
  flawless: boolean;
}

export function scoreDuel(left: DuelFighter, right: DuelFighter): DuelResult {
  const rounds = ROUNDS.map(({ key, label, unit }): DuelRound => {
    const l = left.stats[key];
    const r = right.stats[key];
    if (l === null || r === null) {
      return {
        key,
        label,
        unit,
        left: l,
        right: r,
        winner: null,
        leftShare: 0.5,
      };
    }
    const total = l + r;
    return {
      key,
      label,
      unit,
      left: l,
      right: r,
      winner: l === r ? "tie" : l > r ? "left" : "right",
      leftShare: total > 0 ? l / total : 0.5,
    };
  });

  const wins = {
    left: rounds.filter((r) => r.winner === "left").length,
    right: rounds.filter((r) => r.winner === "right").length,
  };
  const winner =
    wins.left === wins.right ? null : wins.left > wins.right ? "left" : "right";
  const contested = rounds.filter(
    (r) => r.winner === "left" || r.winner === "right"
  ).length;

  return {
    rounds,
    wins,
    winner,
    flawless: winner !== null && wins[winner] === contested && contested > 1,
  };
}

/** `/compare/a-vs-b`, lowercased so every pair has one URL per order. */
export function duelPath(left: string, right: string) {
  return `/compare/${encodeURIComponent(left.toLowerCase())}-vs-${encodeURIComponent(right.toLowerCase())}`;
}

/** Parses "a-vs-b". Logins can contain hyphens, so split on the last "-vs-" that leaves two valid names. */
export function parseDuelSlug(
  slug: string,
  isValid: (login: string) => boolean
): [string, string] | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null;
  }
  const parts = decoded.split("-vs-");
  for (let i = 1; i < parts.length; i++) {
    const left = parts.slice(0, i).join("-vs-");
    const right = parts.slice(i).join("-vs-");
    if (
      isValid(left) &&
      isValid(right) &&
      left.toLowerCase() !== right.toLowerCase()
    ) {
      return [left, right];
    }
  }
  return null;
}

export function duelShareText(
  left: DuelFighter,
  right: DuelFighter,
  result: DuelResult
): string {
  if (!result.winner) {
    return `@${left.login} vs @${right.login} on DevTrack: a ${result.wins.left}–${result.wins.right} draw. Who'd win against you?`;
  }
  const [w, l] = result.winner === "left" ? [left, right] : [right, left];
  const score = `${result.wins[result.winner]}–${result.wins[result.winner === "left" ? "right" : "left"]}`;
  return `@${w.login} beats @${l.login} ${score}${result.flawless ? " (flawless)" : ""} on DevTrack. Who'd win against you?`;
}
