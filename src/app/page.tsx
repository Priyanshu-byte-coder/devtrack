import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ArcadeLanding from "@/components/landing/arcade/ArcadeLanding";
import type { LandingBoard } from "@/components/landing/arcade/types";
import { getLeaderboardData } from "@/lib/leaderboard";
import { rankEntriesByScoreV2 } from "@/lib/gamification/ranking";
import { fetchRepoStats } from "@/lib/repo-stats";
import {
  JsonLd,
  siteJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/seo/json-ld";

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * The page streams without waiting for this, so it can wait out a slow
 * leaderboard build; past this the table shows "Be player 1" instead.
 */
const LEADERS_TIMEOUT_MS = 8000;

async function fetchLeaders(): Promise<LandingBoard> {
  const empty: LandingBoard = { leaders: [], playerCount: 0 };
  try {
    const board = await Promise.race([
      getLeaderboardData(false, { period: "all" }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), LEADERS_TIMEOUT_MS)
      ),
    ]);
    if (!board) return empty;
    const ranked = rankEntriesByScoreV2(Object.values(board.leaders).flat());
    return {
      leaders: ranked.slice(0, 5).map((e) => ({
        username: e.username,
        scoreV2: e.scoreV2,
        tier: e.tier,
        streak: e.streak,
      })),
      playerCount: ranked.length,
    };
  } catch {
    return empty;
  }
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  // Not awaited: the page streams straight away and these fill in.
  return (
    <>
      <JsonLd data={[...siteJsonLd(), softwareApplicationJsonLd()]} />
      <ArcadeLanding repoStats={fetchRepoStats()} board={fetchLeaders()} />
    </>
  );
}
