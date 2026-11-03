import { GitHubRateLimitError } from "@/lib/github-rate-limit";
import { GuestProfileUnavailableError } from "@/lib/guest-profile";

/**
 * GitHub said "not now": a rate limit, or the guest-profile budget guard
 * holding back to protect the leaderboard. Pages show a short "try again"
 * state for these instead of a 500.
 */
export function isGitHubBusyError(error: unknown): boolean {
  return (
    error instanceof GitHubRateLimitError ||
    error instanceof GuestProfileUnavailableError
  );
}
