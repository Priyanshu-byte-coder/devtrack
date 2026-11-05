import "server-only";
import { getLeaderboardData } from "@/lib/leaderboard";
import { rankEntriesByScoreV2 } from "@/lib/gamification/ranking";
import {
  getRankBadgeRow,
  type BadgeBoardPeriod,
  type RankBadgeRow,
} from "@/lib/gamification/queries";

const LIVE_BOARD_TIMEOUT_MS = 4000;

/**
 * A member's rank: the daily snapshot when there is one, else their place on
 * the live (cached) board. Snapshots are only written by the 00:15 UTC cron,
 * so without the fallback anyone who joined today reads "not ranked yet" on
 * their profile and share card, the moment they are most likely to share.
 *
 * Kept out of the README badge route, which must stay on snapshot reads.
 */
export async function getRankRow(
  login: string,
  board: BadgeBoardPeriod
): Promise<RankBadgeRow | null> {
  const row = await getRankBadgeRow(login, board);
  if (row) return row;

  try {
    // A cold board can take a while to build; the profile shouldn't wait on it.
    const live = await Promise.race([
      getLeaderboardData(false, { period: board }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), LIVE_BOARD_TIMEOUT_MS)
      ),
    ]);
    if (!live) return null;
    const ranked = rankEntriesByScoreV2(Object.values(live.leaders).flat());
    const me = login.toLowerCase();
    const entry = ranked.find((e) => e.username.toLowerCase() === me);
    if (!entry) return null;
    return {
      rank: entry.rankV2,
      total: ranked.length,
      tier: entry.tier,
      scoreV2: entry.scoreV2,
      previousRank: null,
      hasPrevious: false,
      level: null,
      xp: null,
      streak: entry.streak,
      commits: entry.commits,
      prs: entry.prs,
    };
  } catch {
    return null;
  }
}
