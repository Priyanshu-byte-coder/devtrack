import { calculateStreak } from "@/lib/streak";

export interface WrappedCommit {
  date: string;
  repo: string;
}

export interface WrappedLanguage {
  name: string;
  bytes: number;
  percentage: number;
}

export interface WrappedPersonality {
  id: string;
  name: string;
  icon: string;
  description: string;
  reason: string;
}

export interface WrappedStats {
  year: number;
  username: string;
  totalCommits: number;
  activeDays: number;
  longestStreak: number;
  mostProductiveMonth: {
    name: string;
    commits: number;
  };
  topLanguages: WrappedLanguage[];
  prsMerged: number;
  mostContributedRepo: {
    name: string;
    commits: number;
  };
  peakCodingHour: {
    hour: number | null;
    label: string;
    commits: number;
  };
  personality: WrappedPersonality;
  generatedAt: string;
  partial: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getYearRange(year: number, now = new Date()) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const requestedEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  const end = requestedEnd.getTime() > now.getTime() ? now : requestedEnd;

  return {
    start,
    end,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    partial: requestedEnd.getTime() > now.getTime(),
  };
}

export function calculateLongestStreak(contributionsByDate: Record<string, number>) {
  const activeDates = new Set(
    Object.entries(contributionsByDate)
      .filter(([, count]) => count > 0)
      .map(([date]) => date)
  );
  const dates = Array.from(activeDates).sort();
  const { longestStreak } = calculateStreak(
    dates.map((day) => new Date(`${day}T00:00:00Z`))
  );
  return longestStreak;
}

export function getMostProductiveMonth(contributionsByDate: Record<string, number>) {
  const monthlyTotals = Array.from({ length: 12 }, () => 0);

  for (const [date, count] of Object.entries(contributionsByDate)) {
    const month = Number(date.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) {
      monthlyTotals[month] += count;
    }
  }

  const bestMonth = monthlyTotals.reduce(
    (best, count, index) => (count > monthlyTotals[best] ? index : best),
    0
  );

  return {
    name: MONTH_NAMES[bestMonth],
    commits: monthlyTotals[bestMonth],
  };
}

export function getMostContributedRepo(commits: WrappedCommit[]) {
  const repoCounts: Record<string, number> = {};

  for (const commit of commits) {
    repoCounts[commit.repo] = (repoCounts[commit.repo] ?? 0) + 1;
  }

  const [name = "No repository data", commitsCount = 0] =
    Object.entries(repoCounts).sort((a, b) => b[1] - a[1])[0] ?? [];

  return { name, commits: commitsCount };
}

export function getPeakCodingHour(hours: number[]) {
  const hourCounts = Array.from({ length: 24 }, () => 0);

  for (const hour of hours) {
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      hourCounts[hour] += 1;
    }
  }

  const bestHour = hourCounts.reduce(
    (best, count, index) => (count > hourCounts[best] ? index : best),
    0
  );
  const commits = hourCounts[bestHour];

  if (commits === 0) {
    return { hour: null, label: "Not enough data yet", commits: 0 };
  }

  return {
    hour: bestHour,
    label: formatHour(bestHour),
    commits,
  };
}

export function calculateLanguagePercentages(
  langTotals: Record<string, number>,
  limit = 3
): WrappedLanguage[] {
  const totalBytes = Object.values(langTotals).reduce(
    (sum, bytes) => sum + bytes,
    0
  );

  return Object.entries(langTotals)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage:
        totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);
}

function formatHour(hour: number) {
  const normalized = hour % 24;
  const suffix = normalized >= 12 ? "pm" : "am";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display}${suffix}`;
}

export function calculatePersonality(
  contributionsByDate: Record<string, number>,
  totalCommits: number,
  prsMerged: number,
  peakCodingHour: { hour: number | null },
  longestStreak: number,
  activeDays: number
): WrappedPersonality {
  // Weekend Warrior
  let weekendCommits = 0;
  for (const [dateStr, count] of Object.entries(contributionsByDate)) {
    const date = new Date(`${dateStr}T00:00:00Z`);
    const day = date.getUTCDay();
    if (day === 0 || day === 6) {
      weekendCommits += count;
    }
  }

  const weekendRatio = totalCommits > 0 ? weekendCommits / totalCommits : 0;
  if (weekendRatio > 0.4) {
    return {
      id: "weekend_warrior",
      name: "Weekend Warrior",
      icon: "🔥",
      description: "You save your best work for the weekend.",
      reason: `${Math.round(weekendRatio * 100)}% of your commits happened on Saturdays and Sundays.`,
    };
  }

  // Night Architect
  if (peakCodingHour.hour !== null && (peakCodingHour.hour >= 22 || peakCodingHour.hour <= 4)) {
    return {
      id: "night_architect",
      name: "Night Architect",
      icon: "🌙",
      description: "You find clarity when the rest of the world sleeps.",
      reason: "Your peak productivity hour falls deep into the night.",
    };
  }

  // Sprint Builder
  const commitsPerActiveDay = activeDays > 0 ? totalCommits / activeDays : 0;
  if (commitsPerActiveDay > 8) {
    return {
      id: "sprint_builder",
      name: "Sprint Builder",
      icon: "⚡",
      description: "When you code, you code with intense momentum.",
      reason: `You average an impressive ${Math.round(commitsPerActiveDay)} commits per active day.`,
    };
  }

  // Silent Architect
  if (totalCommits > 500 && prsMerged < 5) {
    return {
      id: "silent_architect",
      name: "Silent Architect",
      icon: "🏗️",
      description: "You quietly build massive foundations without making a fuss.",
      reason: "You have massive commit volume but rarely open pull requests.",
    };
  }

  // Consistency Monk (Fallback or earned)
  return {
    id: "consistency_monk",
    name: "Consistency Monk",
    icon: "🧘",
    description: "You understand that great software is built one day at a time.",
    reason: longestStreak > 21 
      ? `You achieved an amazing ${longestStreak}-day streak.`
      : activeDays > 100 
      ? `You showed up to code on ${activeDays} different days.`
      : "You maintain steady, reliable habits across your projects.",
  };
}
