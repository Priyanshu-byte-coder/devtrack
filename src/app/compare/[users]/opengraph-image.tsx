import { ImageResponse } from "next/og";
import { isValidGitHubUsername } from "@/lib/validate-github-username";
import { parseDuelSlug, scoreDuel } from "@/lib/duel";
import { getDuelFighter } from "@/lib/duel-data";
import { DuelCard } from "@/lib/gamification/duel-card";
import { SHARE_CARD_SIZE, ShareCard } from "@/lib/gamification/share-card";

export const runtime = "nodejs";
export const alt = "DevTrack duel";
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";
// Fighters come from cached reads; a shared duel is rendered once per window.
export const revalidate = 1800;

export default async function Image({
  params,
}: {
  params: Promise<{ users: string }>;
}) {
  const { users } = await params;
  const parsed = parseDuelSlug(users, isValidGitHubUsername);
  const fighters = parsed
    ? await Promise.all(parsed.map((l) => getDuelFighter(l).catch(() => null)))
    : [null, null];
  const [left, right] = fighters;

  // Unknown or private on either side: the brand card, which confirms nothing.
  const body =
    left && right ? (
      <DuelCard left={left} right={right} result={scoreDuel(left, right)} />
    ) : (
      <ShareCard data={{ state: "unranked", login: "" }} />
    );
  return new ImageResponse(body, { ...SHARE_CARD_SIZE });
}
