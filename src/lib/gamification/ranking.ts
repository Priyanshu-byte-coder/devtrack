/**
 * Overall (score v2) ranking and rank movement. Pure, so the daily cron, the
 * leaderboard page and the dashboard all rank people the same way.
 */

import type { LeaderboardEntry, LeaderboardPayload } from "@/lib/leaderboard";

export interface RankedEntry extends LeaderboardEntry {
  scoreV2: number;
  tier: NonNullable<LeaderboardEntry["tier"]>;
  rankV2: number;
}

/**
 * Every user on a payload, ranked by score v2 (legacy score, then name, break
 * ties). Each metric board lists the same users in a different order, so they
 * are merged by id; entries from caches built before score v2 are skipped.
 */
export function rankByScoreV2(payload: LeaderboardPayload): RankedEntry[] {
  return rankEntriesByScoreV2(Object.values(payload.leaders).flat());
}

export function rankEntriesByScoreV2(
  entries: LeaderboardEntry[]
): RankedEntry[] {
  const byId = new Map<string, LeaderboardEntry>();
  for (const entry of entries)
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  return [...byId.values()]
    .filter(
      (e): e is LeaderboardEntry & Pick<RankedEntry, "scoreV2" | "tier"> =>
        typeof e.scoreV2 === "number" && typeof e.tier === "string"
    )
    .sort(
      (a, b) =>
        b.scoreV2 - a.scoreV2 ||
        b.score - a.score ||
        a.username.localeCompare(b.username)
    )
    .map((entry, i) => ({ ...entry, rankV2: i + 1 }));
}

export type RankMovement =
  | { kind: "up"; places: number }
  | { kind: "down"; places: number }
  | { kind: "same" }
  | { kind: "new" }
  | { kind: "none" };

/**
 * How a rank moved since the baseline snapshot. With no baseline at all (the
 * very first day) nobody is "new", so nothing is shown.
 */
export function rankMovement(
  current: number,
  previous: number | undefined,
  hasBaseline: boolean
): RankMovement {
  if (!hasBaseline) return { kind: "none" };
  if (previous === undefined) return { kind: "new" };
  if (previous > current) return { kind: "up", places: previous - current };
  if (previous < current) return { kind: "down", places: current - previous };
  return { kind: "same" };
}

export interface Climber {
  username: string;
  rank: number;
  places: number;
}

/**
 * The people who moved up the most since the baseline snapshot: biggest
 * jump first, then the higher current rank. Nobody climbs on the first day.
 */
export function biggestClimbers(
  entries: Array<{ id: string; username: string; rank: number }>,
  baselineRanks: Record<string, number>,
  hasBaseline: boolean,
  limit = 3
): Climber[] {
  if (!hasBaseline) return [];
  return entries
    .map((e) => ({ e, move: rankMovement(e.rank, baselineRanks[e.id], true) }))
    .filter(({ move }) => move.kind === "up")
    .map(({ e, move }) => ({
      username: e.username,
      rank: e.rank,
      places: move.kind === "up" ? move.places : 0,
    }))
    .sort((a, b) => b.places - a.places || a.rank - b.rank)
    .slice(0, limit);
}
