import Link from "next/link";
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
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { buttonVariants } from "@/components/ui/button";

const CARD = "px-frame bg-[var(--card)] p-4 sm:p-5";

/**
 * The signed-in user's season standing: rank on the month board (that's what
 * a season is judged on) with movement, tier, score and XP. People not on the
 * leaderboard get an invitation instead, which is the point of the card.
 */
export default async function RankCard({ githubId }: { githubId?: string }) {
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
        <p className="font-mono text-eyebrow uppercase text-[var(--muted-foreground)]">
          This season
        </p>
        <h2
          id="rank-card-title"
          className="mt-1 text-title text-[var(--card-foreground)]"
        >
          You&apos;re not on the leaderboard yet
        </h2>
        <p className="mt-1 max-w-prose text-sm text-[var(--muted-foreground)]">
          Make your profile public and join the leaderboard to get a tier, earn
          XP and see how you rank against developers worldwide.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/dashboard/settings"
            className={buttonVariants({ size: "sm" })}
          >
            Join the leaderboard
          </Link>
          <Link
            href="/leaderboard"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            See who&apos;s on it
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
  const season = new Date().toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return (
    <section className={CARD} aria-labelledby="rank-card-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id="rank-card-title"
          className="font-mono text-eyebrow uppercase text-[var(--muted-foreground)]"
        >
          {season} season
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href={`/u/${me.username.toLowerCase()}#readme-badges`}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Add to your README →
          </Link>
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            View leaderboard →
          </Link>
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-center sm:gap-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-stat text-[var(--card-foreground)]">
              #<AnimatedNumber value={me.rankV2} />
            </span>
            <RankMovementBadge movement={movement} />
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            of {ranked.length} on the board
          </p>
        </div>

        <div className="space-y-1.5">
          <TierBadge tier={me.tier} score={me.scoreV2} />
          <p className="font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
            <AnimatedNumber value={me.scoreV2} /> / 1000 score
          </p>
        </div>

        {progress ? (
          <XpBar xp={progress.xp} />
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">
            XP appears after the next daily update.
          </p>
        )}
      </div>

      {progress && progress.bestTier !== me.tier && (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          Best this far: {TIER_STYLE[progress.bestTier].label}
          {progress.bestRank ? ` · best rank #${progress.bestRank}` : ""}
        </p>
      )}
    </section>
  );
}
