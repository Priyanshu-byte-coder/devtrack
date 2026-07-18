/**
 * Contribution Heatmap Insights calculations library
 */

export interface ContributionDay {
  date: Date;
  dateKey: string;
  count: number;
}

export interface ContributionInsightsResult {
  mostProductiveWeekday: string;
  averageWeeklyContributions: number;
  longestStreak: number;
  longestInactivePeriod: number;
  monthlyTrend: "Increasing" | "Decreasing" | "Stable";
  bestMonth: string;
  bestMonthTotal: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Sorts contribution days chronologically
 */
function sortDays<T extends { date: Date }>(days: T[]): T[] {
  return [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Calculate the weekday with the highest average contributions
 */
export function calculateMostProductiveWeekday(days: ContributionDay[]): string {
  if (!days || days.length === 0) return "N/A";

  const weekdaySums = new Array(7).fill(0);
  const weekdayCounts = new Array(7).fill(0);

  for (const day of days) {
    const weekday = day.date.getDay();
    weekdaySums[weekday] += day.count;
    weekdayCounts[weekday] += 1;
  }

  let maxAvg = -1;
  let bestWeekdayIdx = -1;

  for (let i = 0; i < 7; i++) {
    if (weekdayCounts[i] > 0) {
      const avg = weekdaySums[i] / weekdayCounts[i];
      if (avg > maxAvg) {
        maxAvg = avg;
        bestWeekdayIdx = i;
      }
    }
  }

  if (bestWeekdayIdx === -1 || maxAvg === 0) {
    const hasAnyContribution = days.some(d => d.count > 0);
    if (!hasAnyContribution) return "N/A";
  }

  return WEEKDAYS[bestWeekdayIdx] ?? "N/A";
}

/**
 * Calculate the average contributions per week (total commits / (number of days / 7))
 */
export function calculateAverageWeeklyContributions(days: ContributionDay[]): number {
  if (!days || days.length === 0) return 0;
  const totalCommits = days.reduce((sum, d) => sum + d.count, 0);
  const weeks = days.length / 7;
  return totalCommits / weeks;
}

/**
 * Calculate the longest streak of consecutive days with at least 1 contribution
 */
export function calculateLongestStreak(days: ContributionDay[]): number {
  if (!days || days.length === 0) return 0;

  const sorted = sortDays(days);
  let maxStreak = 0;
  let currentStreak = 0;

  for (const day of sorted) {
    if (day.count > 0) {
      currentStreak += 1;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  return maxStreak;
}

/**
 * Calculate the longest inactive period (consecutive days with 0 contributions)
 */
export function calculateLongestInactivePeriod(days: ContributionDay[]): number {
  if (!days || days.length === 0) return 0;

  const sorted = sortDays(days);
  let maxInactive = 0;
  let currentInactive = 0;

  for (const day of sorted) {
    if (day.count === 0) {
      currentInactive += 1;
      if (currentInactive > maxInactive) {
        maxInactive = currentInactive;
      }
    } else {
      currentInactive = 0;
    }
  }

  return maxInactive;
}

/**
 * Compare recent months and indicate whether activity is Increasing, Decreasing, or Stable
 */
export function calculateMonthlyTrend(days: ContributionDay[]): "Increasing" | "Decreasing" | "Stable" {
  if (!days || days.length === 0) return "Stable";

  const monthData: Record<string, { total: number; count: number }> = {};

  for (const day of days) {
    const year = day.date.getFullYear();
    const month = String(day.date.getMonth() + 1).padStart(2, "0");
    const monthKey = `${year}-${month}`;

    if (!monthData[monthKey]) {
      monthData[monthKey] = { total: 0, count: 0 };
    }
    monthData[monthKey].total += day.count;
    monthData[monthKey].count += 1;
  }

  const sortedMonthKeys = Object.keys(monthData).sort();
  if (sortedMonthKeys.length < 2) return "Stable";

  const latestKey = sortedMonthKeys[sortedMonthKeys.length - 1];
  const prevKey = sortedMonthKeys[sortedMonthKeys.length - 2];

  const latest = monthData[latestKey];
  const prev = monthData[prevKey];

  const latestAvg = latest.total / latest.count;
  const prevAvg = prev.total / prev.count;

  if (prevAvg === 0) {
    return latestAvg > 0 ? "Increasing" : "Stable";
  }

  const diffRatio = (latestAvg - prevAvg) / prevAvg;

  if (diffRatio > 0.10) {
    return "Increasing";
  } else if (diffRatio < -0.10) {
    return "Decreasing";
  } else {
    return "Stable";
  }
}

/**
 * Display the month with the highest total contributions
 */
export function calculateBestContributionMonth(days: ContributionDay[]): { monthName: string; total: number } {
  if (!days || days.length === 0) return { monthName: "N/A", total: 0 };

  const monthTotals: Record<string, { total: number; year: number; monthIdx: number }> = {};

  for (const day of days) {
    const year = day.date.getFullYear();
    const monthIdx = day.date.getMonth();
    const monthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

    if (!monthTotals[monthKey]) {
      monthTotals[monthKey] = { total: 0, year, monthIdx };
    }
    monthTotals[monthKey].total += day.count;
  }

  let maxTotal = -1;
  let bestMonthKey = "";

  for (const key of Object.keys(monthTotals)) {
    if (monthTotals[key].total > maxTotal) {
      maxTotal = monthTotals[key].total;
      bestMonthKey = key;
    }
  }

  if (bestMonthKey === "" || maxTotal === 0) {
    return { monthName: "N/A", total: 0 };
  }

  const best = monthTotals[bestMonthKey];
  const monthName = `${MONTHS[best.monthIdx]} ${best.year}`;

  return { monthName, total: maxTotal };
}

/**
 * Aggregate function to get all insights at once
 */
export function getContributionInsights(days: ContributionDay[]): ContributionInsightsResult {
  const bestMonthInfo = calculateBestContributionMonth(days);
  return {
    mostProductiveWeekday: calculateMostProductiveWeekday(days),
    averageWeeklyContributions: calculateAverageWeeklyContributions(days),
    longestStreak: calculateLongestStreak(days),
    longestInactivePeriod: calculateLongestInactivePeriod(days),
    monthlyTrend: calculateMonthlyTrend(days),
    bestMonth: bestMonthInfo.monthName,
    bestMonthTotal: bestMonthInfo.total,
  };
}
