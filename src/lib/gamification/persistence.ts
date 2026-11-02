import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidateTag } from "next/cache";
import {
  refreshLeaderboardCache,
  type LeaderboardPeriod,
} from "@/lib/leaderboard";
import { rankByScoreV2, type RankedEntry } from "@/lib/gamification/ranking";

export { rankByScoreV2 } from "@/lib/gamification/ranking";
import { GAMIFICATION_CACHE_TAG } from "@/lib/gamification/queries";

const PERIODS: LeaderboardPeriod[] = ["week", "month", "all"];

/** UTC calendar date, YYYY-MM-DD. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monthly season id, YYYY-MM, in UTC. */
export function seasonFor(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export interface CaptureSummary {
  capturedOn: string;
  snapshots: Record<LeaderboardPeriod, number>;
  progressUpdated: number;
  seasonClosed: string | null;
  seasonResults: number;
}

/**
 * Daily job: rebuild each leaderboard (which also refreshes its cache), store
 * the day's ranks, update everyone's progress, and on the 1st of the month
 * record the season that just ended.
 *
 * Safe to re-run: snapshots for the same day are overwritten, progress can
 * only move forward (enforced by a database trigger), and a season's results
 * are written once.
 */
export async function captureGamification(
  now: Date = new Date()
): Promise<CaptureSummary> {
  const capturedOn = utcDay(now);
  const ranked = {} as Record<LeaderboardPeriod, RankedEntry[]>;

  // One period at a time: each build calls GitHub for every user.
  for (const period of PERIODS) {
    ranked[period] = rankByScoreV2(await refreshLeaderboardCache({ period }));
  }

  const snapshots = {} as Record<LeaderboardPeriod, number>;
  for (const period of PERIODS) {
    const rows = ranked[period].map((e) => ({
      user_id: e.id,
      period,
      captured_on: capturedOn,
      rank: e.rankV2,
      score_v2: e.scoreV2,
      tier: e.tier,
      streak: e.streak,
      commits: e.commits,
      prs: e.prs,
      reviews: e.reviews ?? 0,
      active_days: e.activeDays ?? 0,
      repos: e.repos ?? 0,
    }));
    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from("leaderboard_snapshots")
        .upsert(rows, { onConflict: "user_id,period,captured_on" });
      if (error)
        throw new Error(`Saving ${period} snapshots failed: ${error.message}`);
    }
    snapshots[period] = rows.length;
  }

  // XP and level come from lifetime totals (all-time board); tier and rank
  // from the month board, which is what a season is judged on.
  const allTime = new Map(ranked.all.map((e) => [e.id, e]));
  const progress = ranked.month.map((e) => {
    const lifetime = allTime.get(e.id);
    return {
      user_id: e.id,
      xp: lifetime?.xp ?? 0,
      level: lifetime?.level ?? 1,
      tier: e.tier,
      best_tier: e.tier,
      best_rank: e.rankV2,
    };
  });
  if (progress.length > 0) {
    const { error } = await supabaseAdmin
      .from("user_progress")
      .upsert(progress, { onConflict: "user_id" });
    if (error) throw new Error(`Saving progress failed: ${error.message}`);
  }

  // The job runs just after midnight UTC, so on the 1st the rolling month
  // board covers the month that just ended.
  let seasonClosed: string | null = null;
  let seasonResults = 0;
  if (now.getUTCDate() === 1 && ranked.month.length > 0) {
    seasonClosed = seasonFor(new Date(now.getTime() - 86_400_000));
    const results = ranked.month.map((e) => ({
      season: seasonClosed!,
      user_id: e.id,
      rank: e.rankV2,
      score_v2: e.scoreV2,
      tier: e.tier,
    }));
    const { error } = await supabaseAdmin
      .from("season_results")
      .upsert(results, {
        onConflict: "season,user_id",
        ignoreDuplicates: true,
      });
    if (error)
      throw new Error(
        `Closing season ${seasonClosed} failed: ${error.message}`
      );
    seasonResults = results.length;
  }

  // Rank movement and progress shown on pages read through this tag.
  revalidateTag(GAMIFICATION_CACHE_TAG, { expire: 0 });

  return {
    capturedOn,
    snapshots,
    progressUpdated: progress.length,
    seasonClosed,
    seasonResults,
  };
}
