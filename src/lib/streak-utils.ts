import { dateDiffDays, toDateStr } from "@/lib/date-utils";

export type StreakDate = Date | string;

function toDayKey(date: StreakDate): string | null {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    return toDateStr(date);
  }

  const dayKey = date.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey) ? dayKey : null;
}

function getSortedUniqueDays(dates: StreakDate[]): string[] {
  const dayKeys = new Set<string>();

  for (const date of dates) {
    const key = toDayKey(date);
    if (key) dayKeys.add(key);
  }

  return Array.from(dayKeys).sort();
}

function getRuns(dates: StreakDate[]): { end: string; length: number }[] {
  const days = getSortedUniqueDays(dates);
  if (days.length === 0) return [];

  let runLength = 1;
  const runs: { end: string; length: number }[] = [];

  for (let i = 1; i < days.length; i += 1) {
    if (dateDiffDays(days[i - 1], days[i]) === 1) {
      runLength += 1;
      continue;
    }

    runs.push({ end: days[i - 1], length: runLength });
    runLength = 1;
  }

  runs.push({ end: days[days.length - 1], length: runLength });
  return runs;
}

/**
 * Calculates the current streak of consecutive days with activity.
 * @param dates - Array of date objects or strings representing activity days.
 * @returns The length of the current streak in days.
 */
export function calculateCurrentStreak(dates: StreakDate[]): number {
  const runs = getRuns(dates);
  if (runs.length === 0) return 0;

  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  const latestRun = runs[runs.length - 1];

  return latestRun.end === today || latestRun.end === yesterday
    ? latestRun.length
    : 0;
}

/**
 * Calculates the longest streak of consecutive days with activity.
 * @param dates - Array of date objects or strings representing activity days.
 * @returns The length of the longest streak in days.
 */
export function calculateLongestStreak(dates: StreakDate[]): number {
  return getRuns(dates).reduce(
    (longest, run) => Math.max(longest, run.length),
    0
  );
}
