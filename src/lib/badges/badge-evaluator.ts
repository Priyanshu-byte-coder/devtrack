import { ACHIEVEMENTS } from "./badge-config";
import { githubGraphQL } from "@/lib/github-fetch";

export interface UserMetrics {
  currentStreak: number;
  mergedPRs: number;
  completedGoals: number;
}

export interface UnlockedBadge {
  id: string;
  unlockedAt: string; // ISO date string
}

export interface BadgeStatus {
  id: string;
  name: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  progress?: { current: number; target: number };
}

/**
 * Checks if a date corresponds to an "Early Bird" time (before 8:00 AM local time).
 * For simplicity, we check against the UTC time or assume the mergedAt string can be parsed into local time.
 */
function isEarlyBird(dateString: string): boolean {
  const date = new Date(dateString);
  const hours = date.getHours();
  return hours < 8;
}

/**
 * Checks GitHub for recent merged PRs to see if any were merged before 8 AM.
 */
export async function checkEarlyBirdPR(username: string, token: string): Promise<boolean> {
  const query = `
    query($login: String!) {
      user(login: $login) {
        pullRequests(states: MERGED, first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            mergedAt
          }
        }
      }
    }
  `;

  try {
    const data = await githubGraphQL<{
      user: {
        pullRequests: {
          nodes: { mergedAt: string }[];
        };
      };
    }>(query, token, { login: username });

    const prs = data?.user?.pullRequests?.nodes || [];
    return prs.some((pr) => pr.mergedAt && isEarlyBird(pr.mergedAt));
  } catch (error) {
    console.error("Failed to fetch PRs for Early Bird badge:", error);
    return false;
  }
}

/**
 * Evaluates the status of all badges based on user metrics and previously unlocked badges.
 * Unlocked timestamps are preserved if the badge was already unlocked.
 */
export function evaluateBadges(
  metrics: UserMetrics,
  hasEarlyBird: boolean,
  previouslyUnlocked: UnlockedBadge[] = []
): BadgeStatus[] {
  const unlockedMap = new Map(previouslyUnlocked.map((b) => [b.id, b.unlockedAt]));

  return ACHIEVEMENTS.map((badge) => {
    let isUnlocked = unlockedMap.has(badge.id);
    let currentProgress = 0;
    const target = badge.threshold || 1;

    // Evaluate current progress
    switch (badge.id) {
      case "7-day-streak":
        currentProgress = metrics.currentStreak;
        if (currentProgress >= target) isUnlocked = true;
        break;
      case "10-prs-merged":
      case "50-prs-merged":
        currentProgress = metrics.mergedPRs;
        if (currentProgress >= target) isUnlocked = true;
        break;
      case "first-goal":
        currentProgress = metrics.completedGoals;
        if (currentProgress >= target) isUnlocked = true;
        break;
      case "early-bird":
        currentProgress = hasEarlyBird ? 1 : 0;
        if (hasEarlyBird) isUnlocked = true;
        break;
    }

    // Clamp progress
    if (currentProgress > target) {
      currentProgress = target;
    }

    const unlockedAt = isUnlocked
      ? unlockedMap.get(badge.id) || new Date().toISOString()
      : undefined;

    return {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      isUnlocked,
      unlockedAt,
      progress: badge.threshold ? { current: currentProgress, target } : undefined,
    };
  });
}
