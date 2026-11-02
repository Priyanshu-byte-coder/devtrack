import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import type { LeaderboardPeriod } from "@/lib/leaderboard";
import type { Tier } from "@/lib/gamification/scoring";

/** Every read below is cached under this tag; the daily cron revalidates it. */
export const GAMIFICATION_CACHE_TAG = "gamification";
const TTL_SECONDS = 600;

const isPlaywright = () => process.env.PLAYWRIGHT_TEST === "true";

export interface Baseline {
  /** The snapshot day compared against, or null on the very first day. */
  date: string | null;
  /** user id → overall (score v2) rank on that day. */
  ranks: Record<string, number>;
}

export interface Progress {
  xp: number;
  level: number;
  tier: Tier;
  bestTier: Tier;
  bestRank: number | null;
}

/**
 * Ranks from the most recent snapshot before `today`, for ▲/▼ movement.
 * Returns an empty baseline when there is no earlier snapshot or the database
 * is unavailable; movement is decoration, never worth failing a page over.
 */
export const getBaselineRanks = (period: LeaderboardPeriod, today: string) =>
  unstable_cache(
    async (): Promise<Baseline> => {
      if (isPlaywright()) {
        return {
          date: "2026-01-01",
          ranks: {
            "fixture-1": 1,
            "fixture-2": 4,
            "fixture-3": 2,
            "fixture-4": 4,
          },
        };
      }
      if (!isSupabaseAdminAvailable) return { date: null, ranks: {} };
      try {
        const { data: latest } = await supabaseAdmin
          .from("leaderboard_snapshots")
          .select("captured_on")
          .eq("period", period)
          .lt("captured_on", today)
          .order("captured_on", { ascending: false })
          .limit(1);
        const date = latest?.[0]?.captured_on ?? null;
        if (!date) return { date: null, ranks: {} };

        const { data } = await supabaseAdmin
          .from("leaderboard_snapshots")
          .select("user_id, rank")
          .eq("period", period)
          .eq("captured_on", date);
        return {
          date,
          ranks: Object.fromEntries(
            (data ?? []).map((r) => [r.user_id, r.rank])
          ),
        };
      } catch {
        return { date: null, ranks: {} };
      }
    },
    ["gamification-baseline", period, today],
    { revalidate: TTL_SECONDS, tags: [GAMIFICATION_CACHE_TAG] }
  )();

type ProgressRow = {
  user_id: string;
  xp: number;
  level: number;
  tier: string;
  best_tier: string;
  best_rank: number | null;
};

function toProgress(row: ProgressRow): Progress {
  return {
    xp: Number(row.xp),
    level: row.level,
    tier: row.tier as Tier,
    bestTier: row.best_tier as Tier,
    bestRank: row.best_rank,
  };
}

const PLAYWRIGHT_PROGRESS: Record<string, Progress> = {
  "fixture-1": {
    xp: 39185,
    level: 54,
    tier: "legend",
    bestTier: "legend",
    bestRank: 1,
  },
  "fixture-2": {
    xp: 11720,
    level: 24,
    tier: "diamond",
    bestTier: "diamond",
    bestRank: 2,
  },
  "fixture-3": {
    xp: 8660,
    level: 20,
    tier: "platinum",
    bestTier: "diamond",
    bestRank: 2,
  },
  "fixture-4": {
    xp: 2460,
    level: 9,
    tier: "gold",
    bestTier: "gold",
    bestRank: 4,
  },
  "fixture-5": {
    xp: 880,
    level: 5,
    tier: "silver",
    bestTier: "silver",
    bestRank: 5,
  },
};

/** Progress for many users at once (one query), keyed by user id. */
export const getProgressByUserIds = (ids: string[]) =>
  unstable_cache(
    async (): Promise<Record<string, Progress>> => {
      if (isPlaywright()) return PLAYWRIGHT_PROGRESS;
      if (!isSupabaseAdminAvailable || ids.length === 0) return {};
      try {
        const { data } = await supabaseAdmin
          .from("user_progress")
          .select("user_id, xp, level, tier, best_tier, best_rank")
          .in("user_id", ids);
        return Object.fromEntries(
          (data ?? []).map((r) => [r.user_id, toProgress(r)])
        );
      } catch {
        return {};
      }
    },
    ["gamification-progress", [...ids].sort().join(",")],
    { revalidate: TTL_SECONDS, tags: [GAMIFICATION_CACHE_TAG] }
  )();

/** One user's progress, or null if they aren't on the leaderboard yet. */
export async function getProgressForUser(
  userId: string
): Promise<Progress | null> {
  if (isPlaywright()) return PLAYWRIGHT_PROGRESS["fixture-1"];
  const map = await getProgressByUserIds([userId]);
  return map[userId] ?? null;
}

/**
 * Progress for a public profile, by GitHub login. Null for private profiles
 * and for people who haven't joined the leaderboard yet.
 */
export const getProgressForLogin = (login: string) =>
  unstable_cache(
    async (): Promise<Progress | null> => {
      if (isPlaywright()) {
        return login.toLowerCase() === "playwright-user"
          ? PLAYWRIGHT_PROGRESS["fixture-1"]
          : null;
      }
      if (!isSupabaseAdminAvailable) return null;
      try {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id")
          .ilike("github_login", login)
          .eq("is_public", true)
          .maybeSingle();
        if (!user) return null;
        const { data } = await supabaseAdmin
          .from("user_progress")
          .select("user_id, xp, level, tier, best_tier, best_rank")
          .eq("user_id", user.id)
          .maybeSingle();
        return data ? toProgress(data) : null;
      } catch {
        return null;
      }
    },
    ["gamification-progress-login", login.toLowerCase()],
    {
      revalidate: TTL_SECONDS,
      tags: [GAMIFICATION_CACHE_TAG, `public-profile:${login.toLowerCase()}`],
    }
  )();

export type BadgeBoardPeriod = "all" | "month" | "week";

export interface RankBadgeRow {
  rank: number;
  total: number;
  tier: Tier;
  scoreV2: number;
  previousRank: number | null;
  hasPrevious: boolean;
  level: number | null;
  xp: number | null;
  /** Activity behind the rank, from the same snapshot. */
  streak: number;
  commits: number;
  prs: number;
}

/**
 * Everything the README rank badge shows for one login, from the latest
 * snapshot. Null unless the profile is public and on the leaderboard; the
 * badge then reads "not ranked yet" without saying why, so it never reveals
 * whether a private account exists.
 */
export const getRankBadgeRow = (login: string, board: BadgeBoardPeriod) =>
  unstable_cache(
    async (): Promise<RankBadgeRow | null> => {
      if (isPlaywright()) {
        return login.toLowerCase() === "playwright-user"
          ? {
              rank: 1,
              total: 5,
              tier: "legend",
              scoreV2: 929,
              previousRank: 3,
              hasPrevious: true,
              level: 54,
              xp: 39185,
              streak: 42,
              commits: 1284,
              prs: 96,
            }
          : null;
      }
      if (!isSupabaseAdminAvailable) return null;
      try {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id")
          .ilike("github_login", login)
          .eq("is_public", true)
          .eq("leaderboard_opt_in", true)
          .maybeSingle();
        if (!user) return null;

        const { data: latest } = await supabaseAdmin
          .from("leaderboard_snapshots")
          .select("captured_on, rank, tier, score_v2, streak, commits, prs")
          .eq("user_id", user.id)
          .eq("period", board)
          .order("captured_on", { ascending: false })
          .limit(2);
        const current = latest?.[0];
        if (!current) return null;
        const previous = latest?.[1] ?? null;

        const [{ count }, progress] = await Promise.all([
          supabaseAdmin
            .from("leaderboard_snapshots")
            .select("user_id", { count: "exact", head: true })
            .eq("period", board)
            .eq("captured_on", current.captured_on),
          supabaseAdmin
            .from("user_progress")
            .select("xp, level")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        return {
          rank: current.rank,
          total: count ?? current.rank,
          tier: current.tier as Tier,
          scoreV2: current.score_v2,
          previousRank: previous?.rank ?? null,
          hasPrevious: previous !== null,
          level: progress.data?.level ?? null,
          xp: progress.data ? Number(progress.data.xp) : null,
          streak: current.streak,
          commits: current.commits,
          prs: current.prs,
        };
      } catch {
        return null;
      }
    },
    ["gamification-rank-badge", login.toLowerCase(), board],
    {
      revalidate: TTL_SECONDS,
      tags: [GAMIFICATION_CACHE_TAG, `public-profile:${login.toLowerCase()}`],
    }
  )();
