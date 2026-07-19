export interface CodingActivityHourlyCount {
  hour: number;
  count: number;
}

export interface CodingActivityInsightDayCount {
  day: string;
  count: number;
}

export interface CodingActivityInsight {
  timezone: string;
  hourlyCounts: CodingActivityHourlyCount[];
  mostActiveHour: {
    hour: number;
    count: number;
    label: string;
  };
  leastActiveHour: {
    hour: number;
    count: number;
    label: string;
  };
  mostActiveDay?: {
    day: string;
    count: number;
  };
  totalActivities: number;
  dayCounts?: CodingActivityInsightDayCount[];

  consistencyScore?: number;
  averageDailyCommits?: number;
  productivityLevel?: string;

  recommendations?: string[];

  weeklyTrend?: {
    direction: "up" | "down" | "stable";
    percentage: number;
  };

  summary?: string[];
  suggestedWeeklyTarget?: number;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatClockHour(hour: number): string {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const period = normalizedHour < 12 ? "AM" : "PM";
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${displayHour} ${period}`;
}

export function formatHourRange(hour: number): string {
  return `${formatClockHour(hour)} – ${formatClockHour(hour + 1)}`;
}

export function getHourInTimeZone(date: Date, timeZone: string): number {
  if (isNaN(date.getTime())) {
    return 0;
  }

  return Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).format(date)
  );
}

function getDayNameInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).formatToParts(date);

  const dayPart = parts.find((part) => part.type === "weekday")?.value ?? "Sunday";
  return DAY_NAMES.includes(dayPart) ? dayPart : "Sunday";
}

function normalizeOffsetLabel(value: string): string {
  const normalized = value.replace(/^GMT/, "UTC");
  return /^UTC[+-]/.test(normalized) ? normalized.replace(/^UTC/, "UTC ") : normalized;
}

export function formatTimeZoneLabel(timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const offset = formatter
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;

    if (offset) {
      return normalizeOffsetLabel(offset);
    }
  } catch (e) {
    // Fallback to the raw zone name below.
  }

  return timeZone;
}

function pickHighestCount<T extends { count: number }>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  return items.reduce((best, current) => {
    if (current.count > best.count) {
      return current;
    }

    return best;
  }, items[0]);
}

function pickLowestNonZeroCount<T extends { count: number }>(items: T[]): T | null {
  const nonZeroItems = items.filter((item) => item.count > 0);

  if (nonZeroItems.length === 0) {
    return null;
  }

  return nonZeroItems.reduce((best, current) => {
    if (current.count < best.count) {
      return current;
    }

    return best;
  }, nonZeroItems[0]);
}

function calculateConsistencyScore(
  dayCounts: CodingActivityInsightDayCount[]
): number {
  const activeDays = dayCounts.filter((day) => day.count > 0).length;

  return Math.round((activeDays / 7) * 100);
}

function calculateAverageDailyCommits(
  totalActivities: number
): number {
  return Number((totalActivities / 7).toFixed(1));
}

function determineProductivityLevel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Very Good";
  if (score >= 50) return "Good";
  if (score >= 30) return "Moderate";

  return "Low";
}

function generateRecommendations(
  consistencyScore: number,
  averageDailyCommits: number
): string[] {
  const recommendations: string[] = [];

  if (consistencyScore < 50) {
    recommendations.push(
      "Try contributing more consistently throughout the week."
    );
  }

  if (averageDailyCommits < 3) {
    recommendations.push(
      "Increase small daily commits to improve coding momentum."
    );
  }

  if (consistencyScore >= 80) {
    recommendations.push(
      "Excellent consistency! Maintain your current workflow."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Your coding activity looks healthy and balanced."
    );
  }

  return recommendations;
}

function generateSummary(
  mostActiveDay: { day: string; count: number } | undefined,
  consistencyScore: number,
  productivityLevel: string
): string[] {
  const summary: string[] = [];

  if (mostActiveDay) {
    summary.push(
      `Your most productive day was ${mostActiveDay.day} with ${mostActiveDay.count} commits.`
    );
  }

  summary.push(
    `Your weekly consistency score is ${consistencyScore}%.`
  );

  summary.push(
    `Overall productivity level: ${productivityLevel}.`
  );

  return summary;
}

function calculateWeeklyTrend(
  dayCounts: CodingActivityInsightDayCount[]
): {
  direction: "up" | "down" | "stable";
  percentage: number;
} {
  const firstHalfDays = dayCounts.slice(0, 3);
  const firstHalfSum = firstHalfDays.reduce((sum, day) => sum + day.count, 0);
  const firstHalf = firstHalfSum / firstHalfDays.length;

  const secondHalfDays = dayCounts.slice(3);
  const secondHalfSum = secondHalfDays.reduce((sum, day) => sum + day.count, 0);
  const secondHalf = secondHalfSum / secondHalfDays.length;

  if (firstHalf === secondHalf) {
    return {
      direction: "stable",
      percentage: 0,
    };
  }

  if (secondHalf > firstHalf) {
    const percentage = firstHalf === 0
      ? 100
      : Math.round(
          ((secondHalf - firstHalf) / firstHalf) * 100
        );

    return {
      direction: "up",
      percentage,
    };
  }

  const percentage = secondHalf === 0
    ? 100
    : Math.round(
        ((firstHalf - secondHalf) / firstHalf) * 100
      );

  return {
    direction: "down",
    percentage,
  };
}

export function summarizeCodingActivity(
  timestamps: string[],
  timeZone: string
): CodingActivityInsight {
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
  }));
  const dayCounts = DAY_NAMES.map((day) => ({ day, count: 0 }));

  let totalActivities = 0;

  for (const timestamp of timestamps) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    totalActivities += 1;
    const hour = getHourInTimeZone(date, timeZone);
    hourlyCounts[hour].count += 1;

    const dayName = getDayNameInTimeZone(date, timeZone);
    const dayIndex = DAY_NAMES.indexOf(dayName);
    if (dayIndex >= 0) {
      dayCounts[dayIndex].count += 1;
    }
  }

  const mostActiveHour = pickHighestCount(hourlyCounts) ?? hourlyCounts[0];
  const leastActiveHour = pickLowestNonZeroCount(hourlyCounts) ?? hourlyCounts[0];
  const mostActiveDay = pickHighestCount(dayCounts);

  const consistencyScore =
    calculateConsistencyScore(dayCounts);

  const averageDailyCommits =
    calculateAverageDailyCommits(totalActivities);

  const productivityLevel =
    determineProductivityLevel(consistencyScore);

  const recommendations =
    generateRecommendations(
      consistencyScore,
      averageDailyCommits
    );

  const weeklyTrend =
  calculateWeeklyTrend(dayCounts);
  
  const summary = generateSummary(
    mostActiveDay && mostActiveDay.count > 0
      ? {
          day: mostActiveDay.day,
          count: mostActiveDay.count,
        }
      : undefined,
    consistencyScore,
    productivityLevel
  );

  // Suggested weekly target: slightly above recent average, capped at a reasonable level
  const suggestedWeeklyTarget = Math.min(
    Math.max(Math.round((averageDailyCommits ?? 1) * 7 * 1.2), 5),
    50
  );

  return {
    timezone: formatTimeZoneLabel(timeZone),
    hourlyCounts,
    mostActiveHour: {
      hour: mostActiveHour.hour,
      count: mostActiveHour.count,
      label: formatHourRange(mostActiveHour.hour),
    },
    leastActiveHour: {
      hour: leastActiveHour.hour,
      count: leastActiveHour.count,
      label: formatHourRange(leastActiveHour.hour),
    },
    mostActiveDay:
      mostActiveDay && mostActiveDay.count > 0
        ? { day: mostActiveDay.day, count: mostActiveDay.count }
        : undefined,
    totalActivities,
    dayCounts: dayCounts.some((item) => item.count > 0) 
    ? dayCounts 
    : undefined,

    consistencyScore,
    averageDailyCommits,
    productivityLevel,
    recommendations,

     weeklyTrend,

    summary,
    suggestedWeeklyTarget,
  };
}