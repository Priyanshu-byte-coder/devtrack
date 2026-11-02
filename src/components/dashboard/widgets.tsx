"use client";

/**
 * Every dashboard widget, ready to place on a tab. Charts load lazily and
 * below-the-fold widgets mount when scrolled into view, so a tab only fetches
 * what it shows.
 */
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import LazyWidget from "@/components/LazyWidget";
import WidgetErrorBoundary from "@/components/WidgetErrorBoundary";
import WidgetRegion from "@/components/dashboard/WidgetRegion";
import CommunityMetricsWidget from "@/components/CommunityMetrics";
import ConsistencyScoreWidget from "@/components/ConsistencyScoreWidget";
import DailyNoteWidget from "@/components/DailyNoteWidget";
import GoalTrackerWidget from "@/components/GoalTracker";
import InactiveRepositoriesCard from "@/components/InactiveRepositoriesCard";
import IssueMetricsWidget from "@/components/IssueMetrics";
import LanguageBreakdownWidget from "@/components/LanguageBreakdown";
import LocalCodingTimeWidget from "@/components/LocalCodingTime";
import CodingTimeWidget from "@/components/CodingTimeWidget";
import PersonalRecordsWidget from "@/components/PersonalRecords";
import PinnedReposWidget from "@/components/PinnedReposWidget";
import RecentActivityWidget from "@/components/RecentActivity";
import RepoAnalyticsExplorer from "@/components/repo-analytics/RepoAnalyticsExplorer";
import StreakTrackerWidget from "@/components/StreakTracker";
import TopReposWidget from "@/components/TopRepos";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import CIAnalyticsWidget from "@/components/CIAnalytics";
import MilestonePlannerWidget from "@/components/MilestonePlanner";
import { AIMentorWidget } from "@/components/AIMentorWidget";

function Skeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 ${tall ? "min-h-[320px]" : "min-h-[200px]"}`}
    >
      <div className="mb-4 h-4 w-40 rounded bg-[var(--card-muted)] animate-pulse" />
      <div
        className={`${tall ? "h-60" : "h-32"} rounded bg-[var(--card-muted)] animate-pulse`}
      />
    </div>
  );
}

const lazy = <P extends object>(
  loader: () => Promise<{ default: React.ComponentType<P> }>,
  tall = true
) => dynamic(loader, { ssr: false, loading: () => <Skeleton tall={tall} /> });

const ContributionGraphChart = lazy(
  () => import("@/components/ContributionGraph")
);
const ContributionHeatmapChart = lazy(
  () => import("@/components/ContributionHeatmap")
);
const RepoContributionDistributionChart = lazy(
  () => import("@/components/RepoContributionDistribution")
);
const ActivityRingChart = lazy(() => import("@/components/ActivityRingChart"));
const CodingActivityInsightsCard = lazy(
  () => import("@/components/CodingActivityInsightsCard")
);
const CommitTimeChart = lazy(() => import("@/components/CommitTimeChart"));
const ProductiveHoursChart = lazy(
  () => import("@/components/ProductiveHoursWidget")
);
const PRMetricsChart = lazy(() => import("@/components/PRMetrics"));
const PRBreakdownChart = lazy(() => import("@/components/PRBreakdownChart"));
const PRReviewTrendChart = lazy(
  () => import("@/components/PRReviewTrendChart")
);
const FriendComparisonWidget = lazy(
  () => import("@/components/FriendComparison"),
  false
);
const AchievementProgress = lazy(
  () => import("@/components/GitHubAchievementProgress"),
  false
);
const SponsorAnalyticsWidget = lazy(
  () => import("@/components/SponsorAnalytics"),
  false
);

/** Labelled region and error boundary always; mount-on-scroll for widgets below the fold. */
function Slot({
  id,
  title,
  deferred,
  children,
}: {
  id: string;
  title: string;
  deferred: boolean;
  children: ReactNode;
}) {
  const body = <WidgetErrorBoundary>{children}</WidgetErrorBoundary>;
  return (
    <WidgetRegion widgetId={id} title={title}>
      {deferred ? (
        <LazyWidget fallback={<Skeleton tall />}>{body}</LazyWidget>
      ) : (
        body
      )}
    </WidgetRegion>
  );
}

const slot = (
  id: string,
  title: string,
  render: () => ReactNode,
  deferred = false
) => {
  const Widget = () => (
    <Slot id={id} title={title} deferred={deferred}>
      {render()}
    </Slot>
  );
  Widget.displayName = title.replace(/[^A-Za-z]/g, "");
  return Widget;
};

// Overview / activity
export const ContributionGraph = slot(
  "contribution-graph",
  "Contribution Graph",
  () => <ContributionGraphChart />
);
export const ContributionHeatmap = slot(
  "contribution-heatmap",
  "Contribution Heatmap",
  () => <ContributionHeatmapChart />
);
export const WeeklySummary = slot("weekly-summary", "Weekly Summary", () => (
  <WeeklySummaryCard />
));
export const PersonalRecords = slot(
  "personal-records",
  "Personal Records",
  () => <PersonalRecordsWidget />,
  true
);
export const AIMentor = slot(
  "ai-mentor",
  "AI Mentor",
  () => <AIMentorWidget />,
  true
);
export const RecentActivity = slot(
  "recent-activity",
  "Recent Activity",
  () => <RecentActivityWidget />,
  true
);
export const StreakTracker = slot("streak-tracker", "Streak Tracker", () => (
  <StreakTrackerWidget />
));
export const ConsistencyScore = slot(
  "consistency-score",
  "Consistency Score",
  () => <ConsistencyScoreWidget />,
  true
);
export const ActivityRing = slot(
  "activity-ring",
  "Activity Ring",
  () => <ActivityRingChart />,
  true
);
export const CodingActivityInsights = slot(
  "coding-activity-insights",
  "Coding Activity Insights",
  () => <CodingActivityInsightsCard />,
  true
);
export const CommitTime = slot(
  "commit-time",
  "Commit Time",
  () => <CommitTimeChart />,
  true
);
export const ProductiveHours = slot(
  "productive-hours",
  "Productive Hours",
  () => <ProductiveHoursChart />,
  true
);
export const LocalCodingTime = slot(
  "local-coding-time",
  "Local Coding Time",
  () => <LocalCodingTimeWidget />,
  true
);
export const CodingTime = slot(
  "coding-time",
  "Coding Time",
  () => <CodingTimeWidget />,
  true
);

// Pull requests
export const PRMetrics = slot("pr-metrics", "PR Metrics", () => (
  <PRMetricsChart />
));
export const PRBreakdown = slot(
  "pr-breakdown",
  "PR Breakdown",
  () => <PRBreakdownChart />,
  true
);
export const PRReviewTrend = slot(
  "pr-review-trend",
  "PR Review Trend",
  () => <PRReviewTrendChart />,
  true
);
export const IssueMetrics = slot(
  "issue-metrics",
  "Issue Metrics",
  () => <IssueMetricsWidget />,
  true
);
export const CIAnalytics = slot(
  "ci-analytics",
  "CI Analytics",
  () => <CIAnalyticsWidget />,
  true
);

// Repositories
export const RepoAnalytics = slot(
  "repo-analytics",
  "Repository Analytics",
  () => <RepoAnalyticsExplorer />
);
export const TopRepos = slot(
  "top-repos",
  "Top Repositories",
  () => <TopReposWidget />,
  true
);
export const PinnedRepos = slot(
  "pinned-repos",
  "Pinned Repositories",
  () => <PinnedReposWidget />,
  true
);
export const InactiveRepos = slot(
  "inactive-repos",
  "Inactive Repositories",
  () => <InactiveRepositoriesCard />,
  true
);
export const LanguageBreakdown = slot(
  "language-breakdown",
  "Language Breakdown",
  () => <LanguageBreakdownWidget />,
  true
);
export const RepoContributionDistribution = slot(
  "repo-contribution-distribution",
  "Repository Contribution Distribution",
  () => <RepoContributionDistributionChart />,
  true
);

// Goals
export const GoalTracker = slot("goal-tracker", "Goal Tracker", () => (
  <GoalTrackerWidget />
));
export const MilestonePlanner = slot(
  "milestone-planner",
  "Milestone Planner",
  () => <MilestonePlannerWidget />,
  true
);
export const DailyNote = slot(
  "daily-note",
  "Daily Note",
  () => <DailyNoteWidget />,
  true
);
export const Achievements = slot(
  "achievements",
  "Achievements",
  () => <AchievementProgress />,
  true
);

// Community
export const CommunityMetrics = slot(
  "community-metrics",
  "Community Metrics",
  () => <CommunityMetricsWidget />
);
export const FriendComparison = slot(
  "friend-comparison",
  "Friend Comparison",
  () => <FriendComparisonWidget />,
  true
);
export const SponsorAnalytics = slot(
  "sponsor-analytics",
  "Sponsor Analytics",
  () => <SponsorAnalyticsWidget />,
  true
);
