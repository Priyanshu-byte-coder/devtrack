import { ImageResponse } from "next/og";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { getRankBadgeRow } from "@/lib/gamification/queries";
import { getUserByUsername } from "@/lib/supabase";
import { rankMovement } from "@/lib/gamification/ranking";
import { levelFromXp } from "@/lib/gamification/scoring";
import {
  SHARE_CARD_SIZE,
  ShareCard,
  type ShareCardData,
} from "@/lib/gamification/share-card";

export const runtime = "nodejs";
export const alt = "DevTrack rank card";
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";
// Built from cached snapshot reads, not live GitHub calls, so it renders fast
// enough for link-preview crawlers and can be cached between shares.
export const revalidate = 1800;

async function cardData(rawLogin: string): Promise<ShareCardData> {
  const login = normalizeGitHubUsername(rawLogin);
  if (!login) return { state: "unranked", login: "" };

  const row = await getRankBadgeRow(login, "all");
  if (row) {
    return {
      state: "ranked",
      login,
      boardLabel: "GLOBAL",
      rank: row.rank,
      total: row.total,
      tier: row.tier,
      scoreV2: row.scoreV2,
      level: row.level,
      xp: row.xp,
      levelProgress: row.xp === null ? null : levelFromXp(row.xp).fraction,
      movement: rankMovement(
        row.rank,
        row.previousRank ?? undefined,
        row.hasPrevious
      ),
      streak: row.streak,
      commits: row.commits,
      prs: row.prs,
    };
  }

  // Public but not on the leaderboard: name and avatar, no stats. Private or
  // unknown: the brand card, so the image never confirms an account exists.
  const isPlaywright = process.env.PLAYWRIGHT_TEST === "true";
  const publicUser = isPlaywright
    ? null
    : await getUserByUsername(login).catch(() => null);
  return {
    state: "unranked",
    login: publicUser ? publicUser.github_login : "",
  };
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return new ImageResponse(<ShareCard data={await cardData(username)} />, {
    ...SHARE_CARD_SIZE,
  });
}
