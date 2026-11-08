import { ImageResponse } from "next/og";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { getRankRow } from "@/lib/gamification/live-rank";
import { getGuestProfile, getRegistration } from "@/lib/guest-profile";
import { estimateGuestRank } from "@/lib/guest-profile-model";
import { getLeaderboardData } from "@/lib/leaderboard";
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

  const row = await getRankRow(login, "all");
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

  // Public but not on the leaderboard: name and avatar, no stats. Private:
  // the brand card, so the image never confirms a private account exists.
  const registration = await getRegistration(login).catch(() => undefined);
  if (registration === undefined) return { state: "unranked", login: "" };
  if (registration) {
    return { state: "unranked", login: registration.isPublic ? login : "" };
  }
  return (await guestCard(login)) ?? { state: "unranked", login: "" };
}

/** Not on DevTrack: where they'd land if they joined. */
async function guestCard(login: string): Promise<ShareCardData | null> {
  try {
    const guest = await getGuestProfile(login);
    if (!guest) return null;
    const board = await getLeaderboardData(false, { period: "all" });
    if (!board) return { state: "unranked", login: guest.login };
    const estimate = estimateGuestRank(
      guest,
      Object.values(board.leaders).flat()
    );
    const level = levelFromXp(estimate.xp);
    return {
      state: "ranked",
      estimated: true,
      login: guest.login,
      boardLabel: "GLOBAL",
      rank: estimate.rank,
      total: estimate.total,
      tier: estimate.tier,
      scoreV2: estimate.scoreV2,
      level: level.level,
      xp: estimate.xp,
      levelProgress: level.fraction,
      movement: { kind: "none" },
      streak: guest.streak.current,
      commits: guest.lifetime.commits,
      prs: guest.lifetime.prs,
    };
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return new ImageResponse(<ShareCard data={await cardData(username)} />, {
    ...SHARE_CARD_SIZE,
    // `revalidate` above doesn't reach the CDN for a dynamic segment, so
    // without this every profile view and link preview drew a fresh PNG.
    // Ranks move once a day with the nightly snapshot, so a day is safe, and
    // crawlers fetch a card for every profile they visit.
    headers: {
      "Cache-Control":
        "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
