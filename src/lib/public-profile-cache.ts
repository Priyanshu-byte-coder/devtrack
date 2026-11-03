import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  fetchPublicProfile,
  filterPublicProfileData,
  type PublicProfileData,
} from "@/lib/public-profile-data";
import { isValidGitHubUsername } from "@/lib/validate-github-username";
import { publicProfileTag } from "@/lib/public-profile-tags";
import { getGuestProfile, getRegistration } from "@/lib/guest-profile";
import type { GuestProfile } from "@/lib/guest-profile-model";

// Settings changes invalidate the tag at once, so this only bounds how
// stale GitHub activity can get. Each refresh is one GraphQL request.
const PROFILE_TTL_SECONDS = 30 * 60;

/**
 * Public profile data for server rendering, with hidden widgets already removed.
 *
 * Pages call this directly rather than going through `/api/public/[username]`.
 * That route rate-limits per client IP, and server-side calls all share one
 * egress IP, so every profile view on the site was drawing from a single
 * 30-per-minute bucket. Caching per user for a few minutes keeps GitHub usage
 * bounded instead.
 *
 * Returns null when the user does not exist or has not made their profile
 * public. GitHub or database failures throw, so callers can tell an outage
 * apart from a missing profile and avoid marking real profiles as not found.
 */
export const getPublicProfileForPage = cache(
  async (username: string): Promise<PublicProfileData | null> => {
    if (!isValidGitHubUsername(username)) return null;
    const key = username.toLowerCase();

    return unstable_cache(
      async () => {
        const profile = await fetchPublicProfile(key, {
          includeAchievements: true,
        });
        // The filter returns a partial; the page reads each widget behind its
        // own visibility flag, as it did when this data came from the API.
        return profile
          ? (filterPublicProfileData(profile) as PublicProfileData)
          : null;
      },
      ["public-profile-page", key],
      { revalidate: PROFILE_TTL_SECONDS, tags: [publicProfileTag(key)] }
    )();
  }
);

export type ProfileLookup =
  | { kind: "member"; profile: PublicProfileData }
  | { kind: "guest"; profile: GuestProfile }
  | null;

/**
 * Any GitHub login's profile page: members who made their profile public get
 * the full DevTrack profile; people who never signed up get a guest profile
 * from public GitHub data. Private members and unknown logins get null.
 */
export const getProfileForPage = cache(
  async (username: string): Promise<ProfileLookup> => {
    if (!isValidGitHubUsername(username)) return null;

    const registration = await getRegistration(username);
    if (registration) {
      if (!registration.isPublic) return null;
      const profile = await getPublicProfileForPage(username);
      return profile ? { kind: "member", profile } : null;
    }

    const guest = await getGuestProfile(username);
    return guest ? { kind: "guest", profile: guest } : null;
  }
);
