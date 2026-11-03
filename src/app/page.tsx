import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ArcadeLanding from "@/components/landing/arcade/ArcadeLanding";
import type { LandingLeader } from "@/components/landing/arcade/types";
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

/** Don't hold the page for a cold leaderboard build; the table just hides. */
const LEADERS_TIMEOUT_MS = 2500;

async function fetchLeaders(): Promise<{
  leaders: LandingLeader[];
  playerCount: number;
}> {
  const empty = { leaders: [], playerCount: 0 };
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

  const [stats, { leaders, playerCount }] = await Promise.all([
    fetchRepoStats(),
    fetchLeaders(),
  ]);

  return (
    <>
      <JsonLd data={[...siteJsonLd(), softwareApplicationJsonLd()]} />
      <ArcadeLanding
        repoStats={stats}
        leaders={leaders}
        playerCount={playerCount}
      />
    </>
  );
}
