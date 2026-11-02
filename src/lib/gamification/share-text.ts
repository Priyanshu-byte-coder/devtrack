import type { Tier } from "./scoring";
import { TIER_STYLE } from "./tier-palette";

export interface ShareRank {
  rank: number;
  total: number;
  tier: Tier;
  level: number | null;
}

/**
 * The post text for sharing a profile. First person when the owner shares
 * their own profile, third person when anyone else does, so a visitor never
 * posts "I'm #1" about somebody else.
 */
export function buildShareText({
  username,
  isOwner,
  rank,
  streak,
}: {
  username: string;
  isOwner: boolean;
  rank: ShareRank | null;
  streak: number;
}): string {
  if (rank) {
    const who = isOwner ? "I'm" : `@${username} is`;
    const level = rank.level ? ` · LV ${rank.level}` : "";
    return `${who} #${rank.rank} of ${rank.total} on the DevTrack global leaderboard 🏆 ${TIER_STYLE[rank.tier].label} tier${level}. Where do you rank?`;
  }
  const days = `${streak}-day streak`;
  return isOwner
    ? `Tracking my coding on DevTrack 🔥 ${days}. Climb the leaderboard with me:`
    : `Check out @${username}'s coding stats on DevTrack 🔥 ${days}`;
}

export type ShareChannel = "x" | "linkedin" | "native" | "copy";

/** The profile link tagged with where it was shared, for attribution. */
export function shareUrl(profileUrl: string, channel: ShareChannel): string {
  const url = new URL(profileUrl);
  url.searchParams.set("utm_source", channel);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "share");
  return url.toString();
}
