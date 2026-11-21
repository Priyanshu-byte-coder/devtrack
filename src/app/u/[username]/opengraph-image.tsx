import { ImageResponse } from "next/og";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { getRankRow } from "@/lib/gamification/live-rank";
import { getRegistration } from "@/lib/guest-profile";
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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://devtrack.live";

/**
 * The brand card ("Not ranked yet") as a static file, for people who aren't
 * on DevTrack. Scrapers walk the /top boards' 1,300 guest profiles and fetch
 * each one's card once, so caching never helped: every fetch drew a fresh PNG
 * from a GitHub lookup and the whole leaderboard, billed as Active CPU. Few
 * people share a non-member's profile, so the plain card costs little.
 */
const GUEST_CARD_PATH = "/og/devtrack-card.png";

/** Members get their card; people who aren't on DevTrack get the static one. */
type CardSource = ShareCardData | { state: "guest" };

async function cardData(rawLogin: string): Promise<CardSource> {
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
  return { state: "guest" };
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const data = await cardData(username);
  if (data.state === "guest") {
    return new Response(null, {
      status: 307,
      headers: {
        Location: new URL(GUEST_CARD_PATH, SITE_URL).toString(),
        // Temporary, so a guest who joins gets their own card once the CDN
        // copy expires; a day matches the member cards below.
        "Cache-Control": "public, max-age=300, s-maxage=86400",
      },
    });
  }
  return new ImageResponse(<ShareCard data={data} />, {
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
