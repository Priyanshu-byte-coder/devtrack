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

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
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

export const dynamic = "force-dynamic";

const BOARDS: BadgeBoardPeriod[] = ["all", "month", "week"];

const CACHE_CONTROL =
  "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";

function svgResponse(
  svg: string,
  req: NextRequest,
  status = 200
): NextResponse {
  const etag = `"${createHash("sha1").update(svg).digest("base64url").slice(0, 27)}"`;
  const headers = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": CACHE_CONTROL,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    // An SVG opened directly must not run anything.
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };
  if (status === 200 && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(svg, { status, headers });
}

export async function GET(req: NextRequest) {
  const login = normalizeGitHubUsername(req.nextUrl.searchParams.get("user"));
  const boardParam = req.nextUrl.searchParams.get("board") ?? "all";
  const board = (BOARDS as string[]).includes(boardParam)
    ? (boardParam as BadgeBoardPeriod)
    : "all";

  if (!login) {
    return svgResponse(renderRankBadge({ state: "unranked" }), req, 400);
  }

  const row = await getRankBadgeRow(login, board);
  if (!row) return svgResponse(renderRankBadge({ state: "unranked" }), req);

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
  return svgResponse(renderRankBadge(data), req);
}
