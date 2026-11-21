import "server-only";
import { unstable_cache } from "next/cache";
import { getGuestProfile, getRegistration } from "@/lib/guest-profile";
import { estimateGuestRank } from "@/lib/guest-profile-model";
import { getLeaderboardData, getSavedPlayerStats } from "@/lib/leaderboard";
import { getRankBadgeRow } from "@/lib/gamification/queries";
import { levelFromXp, xpFromTotals } from "@/lib/gamification/scoring";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { publicProfileTag } from "@/lib/public-profile-tags";
import type { PublicWidgetKey } from "@/lib/public-profile-data";
import type { DuelFighter, DuelStatKey } from "@/lib/duel";

const DEFAULT_WIDGETS: PublicWidgetKey[] = ["streak", "contributions"];

/** Which duel stats each profile widget covers; hiding a widget hides them. */
const WIDGET_STATS: Record<PublicWidgetKey, DuelStatKey[]> = {
  streak: ["streak", "longestStreak"],
  contributions: ["activeDays", "contributions", "commits"],
  prs: ["prs", "reviews"],
  languages: [],
};

async function publicWidgets(login: string): Promise<PublicWidgetKey[]> {
  if (process.env.PLAYWRIGHT_TEST === "true") return DEFAULT_WIDGETS;
  if (!isSupabaseAdminAvailable) return DEFAULT_WIDGETS;
  const key = login.toLowerCase();
  return unstable_cache(
    async () => {
      const { data } = await supabaseAdmin
        .from("users")
        .select("public_widgets")
        .ilike("github_login", key)
        .limit(1);
      const raw = data?.[0]?.public_widgets;
      return Array.isArray(raw)
        ? (raw.filter((w) => typeof w === "string") as PublicWidgetKey[])
        : DEFAULT_WIDGETS;
    },
    ["duel-widgets", key],
    { revalidate: 300, tags: [publicProfileTag(key)] }
  )();
}

/**
 * A fighter for a compare duel, from public GitHub data, except that ranked
 * members' lifetime totals match the leaderboard. Null for unknown logins
 * and for members who made their profile private; a member's hidden widgets
 * sit their rounds out.
 */
export async function getDuelFighter(
  login: string
): Promise<DuelFighter | null> {
  const registration = await getRegistration(login);
  if (registration && !registration.isPublic) return null;

  const guest = await getGuestProfile(login);
  if (!guest) return null;

  const widgets = registration ? await publicWidgets(login) : null;
  const hidden = new Set<DuelStatKey>(
    widgets
      ? (Object.keys(WIDGET_STATS) as PublicWidgetKey[])
          .filter((w) => !widgets.includes(w))
          .flatMap((w) => WIDGET_STATS[w])
      : []
  );

  const row = registration
    ? await getRankBadgeRow(login, "all").catch(() => null)
    : null;
  let rank: number | null = null;
  let score: number | null;
  let tier: DuelFighter["tier"];
  let xp: number;
  let rankEstimated = true;

  if (registration && !row) {
    // A member who hasn't joined the leaderboard: no score, rank or tier,
    // not even an estimate. That's the choice they made by not opting in.
    score = null;
    tier = null;
    xp = xpFromTotals(guest.lifetime);
  } else if (row) {
    rank = row.rank;
    score = row.scoreV2;
    tier = row.tier;
    xp = row.xp ?? xpFromTotals(guest.lifetime);
    rankEstimated = false;
  } else {
    const board = await getLeaderboardData(false, { period: "all" }).catch(
      () => null
    );
    const estimate = estimateGuestRank(
      guest,
      board ? Object.values(board.leaders).flat() : []
    );
    rank = board ? estimate.rank : null;
    score = estimate.scoreV2;
    tier = estimate.tier;
    xp = estimate.xp;
  }

  // Public lookups miss a member's private-repo work. Ranked members' totals
  // come from the leaderboard instead, which reads them with their own
  // token, so the duel matches the board. Max, since either can be fresher.
  const lifetime = { ...guest.lifetime };
  if (row) {
    const saved = await getSavedPlayerStats(login, "all");
    if (saved) {
      lifetime.commits = Math.max(lifetime.commits, saved.commits);
      lifetime.prs = Math.max(lifetime.prs, saved.prs);
      lifetime.reviews = Math.max(lifetime.reviews, saved.reviews);
    }
  }

  const stats: DuelFighter["stats"] = {
    score,
    streak: guest.streak.current,
    longestStreak: guest.streak.longest,
    activeDays: guest.activeDays,
    contributions: guest.yearContributions,
    commits: lifetime.commits,
    prs: lifetime.prs,
    reviews: lifetime.reviews,
  };
  for (const key of hidden) stats[key] = null;

  return {
    login: guest.login,
    name: guest.name,
    member: registration !== null,
    tier,
    level: levelFromXp(xp).level,
    rank,
    rankEstimated,
    topLanguage:
      widgets && !widgets.includes("languages")
        ? null
        : (guest.topLanguages[0]?.name ?? null),
    stats,
  };
}
