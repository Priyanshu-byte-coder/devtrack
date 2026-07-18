import { calculateStreak } from "@/lib/streak";

export type PersonaKey =
  | "night_owl"
  | "early_bird"
  | "refactorer"
  | "marathoner"
  | "speed_runner"
  | "balanced_builder";

export interface PersonaProfile {
  key: PersonaKey;
  title: string;
  emoji: string;
  description: string;
  gradient: string;
}

export interface SmartInsight {
  title: string;
  description: string;
}

export interface TimeBlocks {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
}

export interface DeveloperSignals {
  commitCountsByDate: Record<string, number>;
  timeBlocks: TimeBlocks;
  prsOpened: number;
  prsMerged: number;
  prMergeTotalHours: number;
  prMergeSampleSize: number;
  additions: number;
  deletions: number;
}

export interface PersonaResponse {
  persona: PersonaProfile;
  insights: SmartInsight[];
}

const PERSONA_PROFILES: Record<PersonaKey, PersonaProfile> = {
  night_owl: {
    key: "night_owl",
    title: "Night Owl",
    emoji: "🌙",
    description: "Most of your commits happen late at night.",
    gradient: "from-[var(--accent)]/12 via-[var(--background)]/88 to-[var(--background)]",
  },
  early_bird: {
    key: "early_bird",
    title: "Early Bird",
    emoji: "☀️",
    description: "Your most productive hours start before the workday.",
    gradient: "from-[var(--success)]/12 via-[var(--background)]/88 to-[var(--background)]",
  },
  refactorer: {
    key: "refactorer",
    title: "Refactorer",
    emoji: "🛠️",
    description: "You are cleaning up more code than you are adding.",
    gradient: "from-[var(--success)]/10 via-[var(--accent)]/8 to-[var(--background)]",
  },
  marathoner: {
    key: "marathoner",
    title: "Marathoner",
    emoji: "🏃",
    description: "You keep long coding streaks going without slowing down.",
    gradient: "from-[var(--accent)]/12 via-[var(--muted)]/10 to-[var(--background)]",
  },
  speed_runner: {
    key: "speed_runner",
    title: "Speed Runner",
    emoji: "⚡",
    description: "Your pull requests are moving from open to merge very quickly.",
    gradient: "from-[var(--destructive)]/12 via-[var(--accent)]/8 to-[var(--background)]",
  },
  balanced_builder: {
    key: "balanced_builder",
    title: "Balanced Builder",
    emoji: "🧭",
    description: "Your activity is spread out evenly across the day.",
    gradient: "from-[var(--muted-foreground)]/10 via-[var(--background)]/88 to-[var(--background)]",
  },
};

function sumTimeBlocks(blocks: TimeBlocks): number {
  return blocks.morning + blocks.afternoon + blocks.evening + blocks.night;
}

function getUtcWeekStart(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  result.setUTCHours(0, 0, 0, 0);

  return result;
}

/**
 * Calculates current and longest streaks, and commit aggregations based on daily commit counts.
 * @param commitCountsByDate - A mapping of date strings to commit counts.
 * @returns An object containing streak statistics and week-over-week commit data.
 */
export function calculateStreaks(commitCountsByDate: Record<string, number>) {
  const commitDays = Object.keys(commitCountsByDate).sort();

  if (commitDays.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActiveDays: 0,
      currentWeekCommits: 0,
      previousWeekCommits: 0,
      activeDaysThisWeek: 0,
    };
  }
  const { currentStreak, longestStreak } = calculateStreak(
    commitDays.map((day) => new Date(day))
  );

  const currentWeekStart = getUtcWeekStart(new Date());
  const previousWeekStart = new Date(currentWeekStart.getTime() - 7 * 86400000);
  const previousWeekEnd = new Date(currentWeekStart.getTime() - 1);

  let currentWeekCommits = 0;
  let previousWeekCommits = 0;
  let activeDaysThisWeek = 0;

  for (const [date, count] of Object.entries(commitCountsByDate)) {
    const commitDate = new Date(date);

    if (commitDate >= currentWeekStart) {
      currentWeekCommits += count;
      activeDaysThisWeek += 1;
      continue;
    }

    if (commitDate >= previousWeekStart && commitDate <= previousWeekEnd) {
      previousWeekCommits += count;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: commitDays.length,
    currentWeekCommits,
    previousWeekCommits,
    activeDaysThisWeek,
  };
}

/**
 * Formats a given number of hours into a human-readable duration string (e.g., '45m', '2.5h', '1.2d').
 * @param hours - The duration in hours.
 * @returns The formatted string.
 */
export function formatDurationHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "0h";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }

  if (hours < 24) {
    return `${Math.round(hours * 10) / 10}h`;
  }

  return `${Math.round((hours / 24) * 10) / 10}d`;
}

/**
 * Chooses the best matching developer persona from a list of scored candidates.
 * @param candidates - The list of eligible personas and their computed scores.
 * @param fallback - The fallback persona to return if no candidate matches strongly.
 * @returns The selected persona key.
 */
export function choosePersonaCandidate(
  candidates: Array<{ key: PersonaKey; score: number; eligible: boolean }>,
  fallback: PersonaKey
): PersonaKey {
  const eligibleCandidates = candidates.filter((candidate) => candidate.eligible);

  if (eligibleCandidates.length > 0) {
    return eligibleCandidates.sort((a, b) => b.score - a.score)[0].key;
  }

  const scoredCandidates = candidates.filter((candidate) => candidate.score > 0);

  if (scoredCandidates.length > 0) {
    return scoredCandidates.sort((a, b) => b.score - a.score)[0].key;
  }

  return fallback;
}

function addInsight(
  insights: Array<SmartInsight & { score: number }>,
  insight: SmartInsight,
  score: number
) {
  insights.push({ ...insight, score });
}

/**
 * Generates personalized "smart insights" based on a developer's metrics and assigned persona.
 * @param signals - The raw developer signals (e.g., timeblocks, deletions).
 * @param summary - Aggregated streak and commit summary.
 * @param persona - The assigned developer persona.
 * @returns An array of top smart insights.
 */
export function buildSmartInsightCandidates(
  signals: DeveloperSignals,
  summary: ReturnType<typeof calculateStreaks>,
  persona: PersonaKey
): SmartInsight[] {
  const insights: Array<SmartInsight & { score: number }> = [];
  const totalChurn = signals.additions + signals.deletions;
  const timeBlockTotal = sumTimeBlocks(signals.timeBlocks);
  const nightRatio = timeBlockTotal > 0 ? signals.timeBlocks.night / timeBlockTotal : 0;
  const morningRatio = timeBlockTotal > 0 ? signals.timeBlocks.morning / timeBlockTotal : 0;

  if (summary.currentStreak >= 3 || summary.activeDaysThisWeek >= 4) {
    addInsight(
      insights,
      {
        title: "Consistent Contributor",
        description: `You committed code on ${summary.activeDaysThisWeek} day${summary.activeDaysThisWeek === 1 ? "" : "s"} this week and are on a ${summary.currentStreak}-day streak.`,
      },
      summary.currentStreak + summary.activeDaysThisWeek
    );
  }

  if (summary.currentWeekCommits > summary.previousWeekCommits && summary.previousWeekCommits > 0) {
    addInsight(
      insights,
      {
        title: "Momentum Builder",
        description: `You shipped ${summary.currentWeekCommits - summary.previousWeekCommits} more commits than last week (${summary.currentWeekCommits} vs ${summary.previousWeekCommits}).`,
      },
      summary.currentWeekCommits - summary.previousWeekCommits
    );
  }

  if (totalChurn >= 25 && signals.deletions > signals.additions) {
    addInsight(
      insights,
      {
        title: "Refactoring Powerhouse",
        description: `You deleted ${signals.deletions - signals.additions} more lines than you added across your recent commits.`,
      },
      (signals.deletions - signals.additions) / totalChurn
    );
  }

  if (signals.prMergeSampleSize >= 2 && signals.prMergeTotalHours > 0) {
    const averageHours = signals.prMergeTotalHours / signals.prMergeSampleSize;

    if (averageHours < 8) {
      addInsight(
        insights,
        {
          title: "PR Champion",
          description: `Your merged PRs are averaging ${formatDurationHours(averageHours)} from open to merge.`,
        },
        8 / averageHours
      );
    }
  }

  if (persona === "night_owl" && nightRatio >= 0.4) {
    addInsight(
      insights,
      {
        title: "Late-Night Focus",
        description: `Nearly ${Math.round(nightRatio * 100)}% of your commits land between 10PM and 4AM.`,
      },
      nightRatio
    );
  }

  if (persona === "early_bird" && morningRatio >= 0.4) {
    addInsight(
      insights,
      {
        title: "Early Session",
        description: `Nearly ${Math.round(morningRatio * 100)}% of your commits land between 5AM and 10AM.`,
      },
      morningRatio
    );
  }

  if (insights.length === 0 && summary.totalActiveDays > 0) {
    addInsight(
      insights,
      {
        title: "Steady Cadence",
        description: `You spread ${Object.values(signals.commitCountsByDate).reduce((sum, count) => sum + count, 0)} commits across ${summary.totalActiveDays} active days.`,
      },
      0.1
    );
  }

  return insights
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score: _score, ...insight }) => insight);
}

/**
 * Constructs the complete developer persona profile and insights based on raw activity signals.
 * @param signals - The developer activity metrics.
 * @returns The computed persona and insights response.
 */
export function buildDeveloperPersonaResponse(
  signals: DeveloperSignals
): PersonaResponse {
  const summary = calculateStreaks(signals.commitCountsByDate);
  const totalCommits = Object.values(signals.commitCountsByDate).reduce(
    (sum, count) => sum + count,
    0
  );
  const timeBlockTotal = sumTimeBlocks(signals.timeBlocks);
  const nightRatio = timeBlockTotal > 0 ? signals.timeBlocks.night / timeBlockTotal : 0;
  const morningRatio = timeBlockTotal > 0 ? signals.timeBlocks.morning / timeBlockTotal : 0;
  const churnTotal = signals.additions + signals.deletions;
  const deletionRatio = churnTotal > 0 ? signals.deletions / churnTotal : 0;
  const averagePrMergeHours =
    signals.prMergeSampleSize > 0
      ? signals.prMergeTotalHours / signals.prMergeSampleSize
      : null;

  const personaKey = choosePersonaCandidate(
    [
      {
        key: "night_owl",
        score: nightRatio,
        eligible: totalCommits >= 5 && nightRatio >= 0.6,
      },
      {
        key: "early_bird",
        score: morningRatio,
        eligible: totalCommits >= 5 && morningRatio >= 0.6,
      },
      {
        key: "refactorer",
        score: deletionRatio,
        eligible: churnTotal >= 25 && signals.deletions > signals.additions,
      },
      {
        key: "marathoner",
        score: Math.min(1, summary.currentStreak / 14 + summary.longestStreak / 30),
        eligible: summary.currentStreak >= 7 || summary.longestStreak >= 14,
      },
      {
        key: "speed_runner",
        score: averagePrMergeHours === null ? 0 : Math.max(0, (12 - averagePrMergeHours) / 12),
        eligible:
          averagePrMergeHours !== null && averagePrMergeHours < 4 && signals.prMergeSampleSize >= 2,
      },
    ],
    "balanced_builder"
  );

  const persona = PERSONA_PROFILES[personaKey];
  const insights = buildSmartInsightCandidates(signals, summary, personaKey);

  return {
    persona,
    insights,
  };
}

/**
 * Merges two maps of daily commit counts.
 * @param a - The first commit counts map.
 * @param b - The second commit counts map.
 * @returns The newly merged map.
 */
export function mergeCommitCounts(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const merged = { ...a };

  for (const [date, count] of Object.entries(b)) {
    merged[date] = (merged[date] ?? 0) + count;
  }

  return merged;
}

/**
 * Merges two sets of developer signals, aggregating counts, times, and churn.
 * @param a - The first DeveloperSignals object.
 * @param b - The second DeveloperSignals object.
 * @returns The aggregated DeveloperSignals.
 */
export function mergeSignals(a: DeveloperSignals, b: DeveloperSignals): DeveloperSignals {
  return {
    commitCountsByDate: mergeCommitCounts(a.commitCountsByDate, b.commitCountsByDate),
    timeBlocks: {
      morning: a.timeBlocks.morning + b.timeBlocks.morning,
      afternoon: a.timeBlocks.afternoon + b.timeBlocks.afternoon,
      evening: a.timeBlocks.evening + b.timeBlocks.evening,
      night: a.timeBlocks.night + b.timeBlocks.night,
    },
    prsOpened: a.prsOpened + b.prsOpened,
    prsMerged: a.prsMerged + b.prsMerged,
    prMergeTotalHours: a.prMergeTotalHours + b.prMergeTotalHours,
    prMergeSampleSize: a.prMergeSampleSize + b.prMergeSampleSize,
    additions: a.additions + b.additions,
    deletions: a.deletions + b.deletions,
  };
}
