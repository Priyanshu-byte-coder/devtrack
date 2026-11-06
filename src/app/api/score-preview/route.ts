import { NextResponse, type NextRequest } from "next/server";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { getDuelFighter } from "@/lib/duel-data";
import { getLeaderboardData } from "@/lib/leaderboard";
import { rankEntriesByScoreV2 } from "@/lib/gamification/ranking";
import { isGitHubBusyError } from "@/lib/github-busy";
import {
  createMemoryFixedWindowRateLimiter,
  getClientIp,
} from "@/lib/rate-limit";
import type { ScorePreview } from "@/lib/score-preview";

export const dynamic = "force-dynamic";

/** Per instance; the CDN cache in front absorbs repeat lookups. */
const limiter = createMemoryFixedWindowRateLimiter({ windowMs: 60_000 });
const LIMIT_PER_MINUTE = 12;

/**
 * The landing page's "score attack": where any GitHub user would land,
 * without signing up. Same data and privacy rules as compare duels.
 */
export async function GET(req: NextRequest) {
  const login = normalizeGitHubUsername(
    req.nextUrl.searchParams.get("user")?.replace(/^@/, "")
  );
  if (!login) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const rate = limiter.check(`score:${getClientIp(req)}`, LIMIT_PER_MINUTE);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "slow-down" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const [fighter, board] = await Promise.all([
      getDuelFighter(login),
      getLeaderboardData(false, { period: "all" }).catch(() => null),
    ]);
    if (!fighter) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    const players = board
      ? rankEntriesByScoreV2(Object.values(board.leaders).flat()).length
      : 0;
    const body: ScorePreview = {
      login: fighter.login,
      name: fighter.name,
      member: fighter.member,
      tier: fighter.tier,
      level: fighter.level,
      rank: fighter.rank,
      rankEstimated: fighter.rankEstimated,
      // A guest joining makes the board one bigger.
      players: fighter.rankEstimated ? players + 1 : players,
      streak: fighter.stats.streak,
      contributions: fighter.stats.contributions,
      prs: fighter.stats.prs,
      topLanguage: fighter.topLanguage,
    };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    if (isGitHubBusyError(error)) {
      return NextResponse.json(
        { error: "busy" },
        { status: 503, headers: { "Retry-After": "60" } }
      );
    }
    throw error;
  }
}
