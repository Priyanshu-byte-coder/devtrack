import { parseISO } from "date-fns/parseISO";
import { startOfWeek } from "date-fns/startOfWeek";
import { subMonths } from "date-fns/subMonths";
import { subWeeks } from "date-fns/subWeeks";
import { format } from "date-fns/format";
import { dateDiffDays } from "@/lib/date-utils";
import { calculateStreakFromDates } from "@/lib/streak";

export interface ConsistencyScoreResult {
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  weeklyConsistency: number;
  monthlyTrend: { month: string; activeDays: number }[];
  longestGap: number;
  avgDailyCommits: number;
  streakQuality: number;
  improvementTip: string;
}

function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function mondayOfWeek(dateStr: string): string {
  const monday = startOfWeek(parseISO(dateStr), { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

function hasActivityInLastNDays(
  activeDates: Set<string>,
  days: number,
  today: string,
): boolean {
  for (const dateStr of activeDates) {
    const diff = dateDiffDays(dateStr, today);
    if (diff >= 0 && diff < days) {
      return true;
    }
  }
  return false;
}

function computeWeeklyConsistency(activeDates: Set<string>): number {
  const activeWeeks = new Set<string>();
  for (const dateStr of activeDates) {
    activeWeeks.add(mondayOfWeek(dateStr));
  }

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  let weeksWithActivity = 0;

  for (let i = 0; i < 12; i += 1) {
    const weekStart = format(subWeeks(thisWeekStart, i), "yyyy-MM-dd");
    if (activeWeeks.has(weekStart)) {
      weeksWithActivity += 1;
    }
  }

  return Math.round((weeksWithActivity / 12) * 100);
}

function computeMonthlyTrend(
  activeDates: Set<string>,
): { month: string; activeDays: number }[] {
  const trend: { month: string; activeDays: number }[] = [];

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = subMonths(new Date(), i);
    const monthKey = format(monthDate, "yyyy-MM");
    const monthLabel = format(monthDate, "MMM yyyy");
    let activeDays = 0;

    for (const dateStr of activeDates) {
      if (dateStr.startsWith(monthKey)) {
        activeDays += 1;
      }
    }

    trend.push({ month: monthLabel, activeDays });
  }

  return trend;
}

function computeLongestGap(sortedDates: string[]): number {
  if (sortedDates.length < 2) {
    return 0;
  }

  let longestGap = 0;
  for (let i = 1; i < sortedDates.length; i += 1) {
    const gap = dateDiffDays(sortedDates[i - 1], sortedDates[i]) - 1;
    longestGap = Math.max(longestGap, Math.max(0, gap));
  }

  return longestGap;
}

function scoreToGrade(score: number): ConsistencyScoreResult["grade"] {
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function getImprovementTip(score: number): string {
  if (score < 40) {
    return "Try committing at least once every 2-3 days to build consistency";
  }
  if (score < 60) {
    return "You are making progress! Aim for 4+ active days per week";
  }
  if (score < 75) {
    return "Good consistency! Try to reduce gaps between coding sessions";
  }
  if (score < 90) {
    return "Great work! Maintain your current streak to reach S tier";
  }
  return "Outstanding consistency! You are in the top tier of developers";
}

export function calculateConsistencyScore(
  activeDates: Set<string>,
  timeZone = "UTC",
): ConsistencyScoreResult {
  const sortedDates = Array.from(activeDates).sort();
  const today = todayInTimezone(timeZone);

  const weeklyConsistency = computeWeeklyConsistency(activeDates);
  const monthlyTrend = computeMonthlyTrend(activeDates);
  const longestGap = computeLongestGap(sortedDates);

  const streak = calculateStreakFromDates(activeDates, new Set(), timeZone);
  const streakQuality =
    streak.longest > 0 ? streak.current / streak.longest : 0;

  const avgDailyCommits = sortedDates.length > 0 ? 1 : 0;

  const weeklyPoints = (weeklyConsistency / 100) * 40;
  const streakPoints = streakQuality * 30;
  const gapPoints = 20 - Math.min(20, longestGap / 7);

  let recentPoints = 0;
  if (hasActivityInLastNDays(activeDates, 7, today)) {
    recentPoints = 10;
  } else if (hasActivityInLastNDays(activeDates, 14, today)) {
    recentPoints = 5;
  }

  const score = Math.round(
    Math.min(100, Math.max(0, weeklyPoints + streakPoints + gapPoints + recentPoints)),
  );

  return {
    score,
    grade: scoreToGrade(score),
    weeklyConsistency,
    monthlyTrend,
    longestGap,
    avgDailyCommits,
    streakQuality,
    improvementTip: getImprovementTip(score),
  };
}

export function isRecentlyActiveFromScore(data: ConsistencyScoreResult): boolean {
  const weeklyPoints = (data.weeklyConsistency / 100) * 40;
  const streakPoints = data.streakQuality * 30;
  const gapPoints = 20 - Math.min(20, data.longestGap / 7);
  const withoutRecent = Math.round(
    Math.min(100, Math.max(0, weeklyPoints + streakPoints + gapPoints)),
  );
  return data.score - withoutRecent >= 10;
}
