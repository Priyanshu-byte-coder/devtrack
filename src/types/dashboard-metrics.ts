import type { ConsistencyScoreResult } from "@/lib/consistency-score";

export interface WeeklySummaryData {
  commits: {
    current: number;
    previous: number;
    delta: number;
    trend: "up" | "down" | "same";
  };
  prs: {
    thisWeek: { opened: number; merged: number };
    lastWeek: { opened: number; merged: number };
  };
  issues?: {
    thisWeek: { opened: number; closed: number } | number;
    lastWeek: { opened: number; closed: number } | number;
  };
  productivityScore?: {
    current: number;
    previous: number;
  };
  activeDays: {
    thisWeek: number;
    lastWeek: number;
  };
  streak: number;
  topRepo: string | null;
  repoBreakdown?: { repoName: string; commits: number }[];
  dailyCommits?: { date: string; commits: number }[];
  mostActiveDay?: string | null;
}

export interface StreakData {
  current: number;
  longest: number;
  lastCommitDate: string | null;
  totalActiveDays: number;
  freezeDates: string[];
}

export interface ContributionData {
  days: number;
  total: number;
  data: Record<string, number>;
}

export interface PRMetricsSummary {
  open: number;
  merged: number;
  closed: number;
  total: number;
  totalAdditions?: number;
  totalDeletions?: number;
  avgReviewHours: number;
  avgFirstReviewHours: number | null;
  mergeRate: string;
  avgCycleTime?: number;
  weeklyTrend?: { week: string; avgHours: number }[];
  slowestRepos?: { repo: string; avgHours: number }[];
}

export interface PRData extends PRMetricsSummary {
  gitlab?: PRMetricsSummary;
  reviews?: {
    totalReviews: number;
    approvalRate: string;
    topRepos: { repo: string; count: number }[];
  };
}

export interface CommunityData {
  discussionsStarted: number;
  acceptedAnswers: number;
  commentsPosted: number;
}

export interface IssueData {
  opened: number;
  closed: number;
  currentlyOpen: number;
  avgCloseTimeDays: number;
  trend: number;
  mostActiveRepo: string | null;
}

export interface DashboardMetricsData {
  weeklySummary?: WeeklySummaryData;
  streak?: StreakData;
  contributions30?: ContributionData;
  contributions365?: ContributionData;
  prs?: PRData;
  consistencyScore?: ConsistencyScoreResult;
  discussions?: CommunityData;
  issues?: IssueData;
}
