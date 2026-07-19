/**
 * Evidence-based progress estimator for locked GitHub achievements.
 *
 * Only achievements that have a reliable proxy in the GitHub API are given a
 * percentage; the rest surface "Progress unavailable" rather than fabricating
 * a number.
 *
 * Estimation strategy
 * -------------------
 *  Pull Shark           viewer.pullRequests(states:[MERGED]).totalCount
 *                       Bronze >= 2  ·  Silver >= 16  ·  Gold >= 128
 *
 *  Galaxy Brain         viewer.repositoryDiscussionComments(onlyAnswers:true).totalCount
 *                       Bronze >= 2  ·  Silver >= 8   ·  Gold >= 16
 *
 *  Quickdraw            No public API proxy  -> dataAvailable: false
 *  Pair Extraordinaire  No public API proxy  -> dataAvailable: false
 */

export interface AchievementMilestone {
  tier: "Bronze" | "Silver" | "Gold";
  threshold: number;
}

export interface AchievementProgressInfo {
  /** GitHub achievement slug (lower-kebab-case). */
  slug: string;
  /** Human-readable display name. */
  title: string;
  /**
   * True when the API exposes a reliable proxy metric.
   * False -> display "Progress unavailable" rather than a progress bar.
   */
  dataAvailable: boolean;
  /** Raw count from the API (only present when dataAvailable is true). */
  currentValue?: number;
  /** The next milestone the user is working towards. Absent when all tiers earned. */
  nextMilestone?: AchievementMilestone;
  /**
   * Progress towards nextMilestone as a percentage [0, 100].
   * Clamped so it never exceeds 100 even when currentValue > threshold.
   */
  progressPercent?: number;
  /** Short human-readable label, e.g. "12 / 16 merged PRs". */
  progressDescription?: string;
}

// --- Pull Shark milestones ---------------------------------------------------

const PULL_SHARK_MILESTONES: AchievementMilestone[] = [
  { tier: "Bronze", threshold: 2 },
  { tier: "Silver", threshold: 16 },
  { tier: "Gold", threshold: 128 },
];

// --- Galaxy Brain milestones -------------------------------------------------

const GALAXY_BRAIN_MILESTONES: AchievementMilestone[] = [
  { tier: "Bronze", threshold: 2 },
  { tier: "Silver", threshold: 8 },
  { tier: "Gold", threshold: 16 },
];

// --- Helpers -----------------------------------------------------------------

/**
 * Given the user's current count and an ordered list of milestones (ascending),
 * return the next milestone they have not yet reached plus their progress
 * percentage towards it.
 *
 * If the user has passed the previous milestone:
 *   prevThreshold = that milestone's threshold (or 0 for the first tier)
 *   progress = (current - prevThreshold) / (next.threshold - prevThreshold)
 *
 * Returns progressPercent = 100 and nextMilestone = undefined when all tiers
 * have been reached.
 */
export function computeMilestoneProgress(
  current: number,
  milestones: AchievementMilestone[]
): { nextMilestone: AchievementMilestone | undefined; progressPercent: number } {
  if (milestones.length === 0) {
    return { nextMilestone: undefined, progressPercent: 100 };
  }

  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];
    if (current < milestone.threshold) {
      const prevThreshold = i === 0 ? 0 : milestones[i - 1].threshold;
      const range = milestone.threshold - prevThreshold;
      const progress = Math.min(
        100,
        Math.max(0, Math.floor(((current - prevThreshold) / range) * 100))
      );
      return { nextMilestone: milestone, progressPercent: progress };
    }
  }

  return { nextMilestone: undefined, progressPercent: 100 };
}

// --- Per-achievement estimators ----------------------------------------------

/**
 * Estimate Pull Shark progress from the total count of merged pull requests.
 */
export function estimatePullSharkProgress(mergedPRs: number): AchievementProgressInfo {
  const { nextMilestone, progressPercent } = computeMilestoneProgress(
    mergedPRs,
    PULL_SHARK_MILESTONES
  );

  const label = nextMilestone
    ? `${mergedPRs} / ${nextMilestone.threshold} merged PRs`
    : `${mergedPRs} merged PRs (all tiers reached)`;

  return {
    slug: "pull-shark",
    title: "Pull Shark",
    dataAvailable: true,
    currentValue: mergedPRs,
    nextMilestone,
    progressPercent,
    progressDescription: label,
  };
}

/**
 * Estimate Galaxy Brain progress from the count of discussion comments marked
 * as accepted answers.
 */
export function estimateGalaxyBrainProgress(
  acceptedAnswers: number
): AchievementProgressInfo {
  const { nextMilestone, progressPercent } = computeMilestoneProgress(
    acceptedAnswers,
    GALAXY_BRAIN_MILESTONES
  );

  const label = nextMilestone
    ? `${acceptedAnswers} / ${nextMilestone.threshold} accepted answers`
    : `${acceptedAnswers} accepted answers (all tiers reached)`;

  return {
    slug: "galaxy-brain",
    title: "Galaxy Brain",
    dataAvailable: true,
    currentValue: acceptedAnswers,
    nextMilestone,
    progressPercent,
    progressDescription: label,
  };
}

/**
 * Quickdraw has no public API proxy (closing speed relative to open time is
 * not queryable). Returns a stub with dataAvailable: false.
 */
export function getQuickdrawProgress(): AchievementProgressInfo {
  return {
    slug: "quickdraw",
    title: "Quickdraw",
    dataAvailable: false,
  };
}

/**
 * Pair Extraordinaire requires co-authored commit data which is not exposed
 * via the public GitHub API. Returns a stub with dataAvailable: false.
 */
export function getPairExtraordinaireProgress(): AchievementProgressInfo {
  return {
    slug: "pair-extraordinaire",
    title: "Pair Extraordinaire",
    dataAvailable: false,
  };
}

// --- Orchestrator ------------------------------------------------------------

/**
 * Build the full set of locked-achievement progress objects.
 *
 * Achievements whose slug appears in `unlockedSlugs` are omitted — they are
 * already displayed in the main achievements panel.
 *
 * @param data           Metrics retrieved from the GitHub API.
 * @param unlockedSlugs  Slugs of achievements the user has already unlocked.
 */
export function buildLockedAchievementProgress(
  data: { mergedPRs: number; acceptedAnswers: number } | null,
  unlockedSlugs: Set<string>
): AchievementProgressInfo[] {
  const results: AchievementProgressInfo[] = [];

  if (!unlockedSlugs.has("pull-shark")) {
    results.push(
      data !== null
        ? estimatePullSharkProgress(data.mergedPRs)
        : { slug: "pull-shark", title: "Pull Shark", dataAvailable: false }
    );
  }

  if (!unlockedSlugs.has("galaxy-brain")) {
    results.push(
      data !== null
        ? estimateGalaxyBrainProgress(data.acceptedAnswers)
        : { slug: "galaxy-brain", title: "Galaxy Brain", dataAvailable: false }
    );
  }

  if (!unlockedSlugs.has("quickdraw")) {
    results.push(getQuickdrawProgress());
  }

  if (!unlockedSlugs.has("pair-extraordinaire")) {
    results.push(getPairExtraordinaireProgress());
  }

  return results;
}
