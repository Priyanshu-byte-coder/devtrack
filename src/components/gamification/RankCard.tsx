import Link from "@/components/Link";
import { getUserByGithubId } from "@/lib/supabase";
import { getLeaderboardData } from "@/lib/leaderboard";
import { rankEntriesByScoreV2, rankMovement } from "@/lib/gamification/ranking";
import {
  getBaselineRanks,
  getProgressForUser,
} from "@/lib/gamification/queries";
import { TIER_STYLE } from "./tier-style";
import TierBadge from "./TierBadge";
import XpBar from "./XpBar";
import RankMovementBadge from "./RankMovementBadge";
import LevelUpCelebration from "./LevelUpCelebration";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { buttonVariants } from "@/components/ui/button";
import { getLocale, getTranslations } from "next-intl/server";

const CARD = "px-frame bg-[var(--card)] p-4 sm:p-5";

/**
 * The signed-in user's season standing: rank on the month board (that's what
 * a season is judged on) with movement, tier, score and XP. People not on the
 * leaderboard get an invitation instead, which is the point of the card.
 */
export default async function RankCard({ githubId }: { githubId?: string }) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const isPlaywright = process.env.PLAYWRIGHT_TEST === "true";
  const user = isPlaywright
    ? { id: "fixture-1" }
    : githubId
      ? await getUserByGithubId(githubId)
      : null;

  const [board, progress] = await Promise.all([
    getLeaderboardData(false, { period: "month" }),
    user ? getProgressForUser(user.id) : Promise.resolve(null),
  ]);
  const ranked = board
    ? rankEntriesByScoreV2(Object.values(board.leaders).flat())
    : [];
  const me = user ? ranked.find((e) => e.id === user.id) : undefined;

  if (!me) {
    return (
      <section className={CARD} aria-labelledby="rank-card-title">
        <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          {t("season.thisSeason")}
        </p>
        <h2
          id="rank-card-title"
          className="mt-1 font-pixel text-xl uppercase text-[var(--card-foreground)]"
        >
          {t("season.notOnLeaderboardTitle")}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-[var(--muted-foreground)]">
          {t("season.notOnLeaderboardDescription")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/claim" className={buttonVariants({ size: "sm" })}>
            {t("season.joinLeaderboard")}
          </Link>
          <Link
            href="/leaderboard"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {t("season.seeWhosOnIt")}
          </Link>
        </div>
      </section>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const baseline = await getBaselineRanks("month", today);
  const movement = rankMovement(
    me.rankV2,
    baseline.ranks[me.id],
    baseline.date !== null
  );
  const season = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(new Date());

  const formattedRankedLength = new Intl.NumberFormat(locale).format(
    ranked.length
  );

  return (
    <section className={CARD} aria-labelledby="rank-card-title">
      <LevelUpCelebration
        login={me.username}
        level={progress?.level ?? null}
        tier={me.tier}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id="rank-card-title"
          className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]"
        >
          {t("season.monthSeason", { month: season })}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href={`/u/${me.username.toLowerCase()}#readme-badges`}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {t("season.addToReadme")}
          </Link>
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {t("season.viewLeaderboard")}
          </Link>
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-center sm:gap-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-pixel text-5xl leading-none text-[var(--card-foreground)]">
              #<AnimatedNumber value={me.rankV2} />
            </span>
            <RankMovementBadge movement={movement} />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("season.ofTotalOnBoard", { total: formattedRankedLength })}
          </p>
        </div>

        <div className="space-y-1.5">
          <TierBadge tier={me.tier} score={me.scoreV2} />
          <p className="font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
            {t("season.scoreOutOfThousand", {
              score: new Intl.NumberFormat(locale).format(me.scoreV2),
            })}
          </p>
        </div>

        {progress ? (
          <XpBar xp={progress.xp} />
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("season.xpAppearsAfterUpdate")}
          </p>
        )}
      </div>

      {progress && progress.bestTier !== me.tier && (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          {t("season.bestThisFar", {
            tier: TIER_STYLE[progress.bestTier].label,
          })}
          {progress.bestRank
            ? ` · ${t("season.bestRank", {
                rank: new Intl.NumberFormat(locale).format(progress.bestRank),
              })}`
            : ""}
        </p>
      )}
    </section>
  );
}
