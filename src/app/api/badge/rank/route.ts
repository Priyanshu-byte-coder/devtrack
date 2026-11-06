/**
 * README rank badge: /api/badge/rank?user=<login>[&board=all|month|week]
 *
 * Embed in a README:
 *   [![DevTrack rank](https://devtrack.live/api/badge/rank?user=octocat)](https://devtrack.live/u/octocat)
 *
 * GitHub fetches README images through its proxy and keeps them for a year
 * unless told otherwise, so the response always carries an explicit short
 * Cache-Control plus an ETag. No per-IP rate limit: every README view arrives
 * from the same few proxy addresses, and the data is cached snapshot reads,
 * not GitHub API calls.
 */

import type { NextRequest } from "next/server";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import {
  getRankBadgeRow,
  type BadgeBoardPeriod,
} from "@/lib/gamification/queries";
import {
  renderRankBadge,
  type RankBadgeData,
} from "@/lib/gamification/rank-badge";
import { rankMovement } from "@/lib/gamification/ranking";
import { levelFromXp } from "@/lib/gamification/scoring";
import { svgBadgeResponse } from "@/lib/gamification/badge-response";

export const dynamic = "force-dynamic";

const BOARDS: BadgeBoardPeriod[] = ["all", "month", "week"];

export async function GET(req: NextRequest) {
  const login = normalizeGitHubUsername(req.nextUrl.searchParams.get("user"));
  const boardParam = req.nextUrl.searchParams.get("board") ?? "all";
  const board = (BOARDS as string[]).includes(boardParam)
    ? (boardParam as BadgeBoardPeriod)
    : "all";

  if (!login) {
    return svgBadgeResponse(renderRankBadge({ state: "unranked" }), req, {
      status: 400,
    });
  }

  const row = await getRankBadgeRow(login, board);
  if (!row)
    return svgBadgeResponse(renderRankBadge({ state: "unranked" }), req);

  const data: RankBadgeData = {
    state: "ranked",
    board,
    rank: row.rank,
    total: row.total,
    tier: row.tier,
    scoreV2: row.scoreV2,
    level: row.level,
    levelProgress: row.xp === null ? null : levelFromXp(row.xp).fraction,
    movement: rankMovement(
      row.rank,
      row.previousRank ?? undefined,
      row.hasPrevious
    ),
  };
  return svgBadgeResponse(renderRankBadge(data), req);
}
