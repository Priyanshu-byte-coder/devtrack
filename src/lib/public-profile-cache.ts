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

const PROFILE_TTL_SECONDS = 300;

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
