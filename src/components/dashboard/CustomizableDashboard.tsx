"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import CommitHeatmap from "@/components/CommitHeatmap";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  type DragEndEvent,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  SortableContext,
} from "@dnd-kit/sortable";
import dynamic from "next/dynamic";
import LazyWidget from "@/components/LazyWidget";
import DiscussionsWidget from "@/components/DiscussionsWidget";
import CommunityMetrics from "@/components/CommunityMetrics";
import GoalTracker from "@/components/GoalTracker";
import StreakTracker from "@/components/StreakTracker";
import ConsistencyScoreWidget from "@/components/ConsistencyScoreWidget";
import TopRepos from "@/components/TopRepos";
import PinnedReposWidget from "@/components/PinnedReposWidget";
import InactiveRepositoriesCard from "@/components/InactiveRepositoriesCard";
import LanguageBreakdown from "@/components/LanguageBreakdown";
import CIAnalytics from "@/components/CIAnalytics";
import IssueMetrics from "@/components/IssueMetrics";
import RepoAnalyticsExplorer from "@/components/repo-analytics/RepoAnalyticsExplorer";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import { AIMentorWidget } from "@/components/AIMentorWidget";
import PersonalRecords from "@/components/PersonalRecords";
import LocalCodingTime from "@/components/LocalCodingTime";
import CodingTimeWidget from "@/components/CodingTimeWidget";
import RecentActivity from "@/components/RecentActivity";
import DailyNoteWidget from "@/components/DailyNoteWidget";
import WidgetErrorBoundary from "@/components/WidgetErrorBoundary";
import DashboardLayoutToolbar from "@/components/dashboard/DashboardLayoutToolbar";
import { DashboardWidgetA11yProvider } from "@/components/dashboard/DashboardWidgetA11yContext";
import SortableDashboardWidget from "@/components/dashboard/SortableDashboardWidget";
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  DASHBOARD_SECTION_LABELS,
  DASHBOARD_WIDGET_LABELS,
  DASHBOARD_SECTIONS,
  getDefaultDashboardLayout,
  hideWidget,
  moveWidget,
  normalizeDashboardLayout,
  resetDashboardLayout,
  showWidget,
  type DashboardLayoutPreference,
  type DashboardSectionId,
  type DashboardWidgetId,
} from "@/lib/dashboard-layout";

export const RepoWidgetSkeleton = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading repository widget"
    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full"
  >
    <div className="flex items-center justify-between mb-6" aria-hidden="true">
      <div className="h-6 w-40 bg-[var(--card-muted)] rounded animate-pulse" />
      <div className="h-6 w-20 bg-[var(--card-muted)] rounded animate-pulse" />
    </div>
    <div className="space-y-5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-1/3 bg-[var(--card-muted)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--card-muted)] rounded animate-pulse" />
          </div>
          <div className="h-1.5 w-full bg-[var(--control)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--card-muted)] animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading chart"
    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full min-h-[280px]"
  >
    <div className="h-6 w-32 bg-[var(--card-muted)] rounded mb-6 animate-pulse" aria-hidden="true" />
    <div className="h-48 w-full bg-[var(--card-muted)] rounded-lg animate-pulse" aria-hidden="true" />
  </div>
);

export const StatsGridSkeleton = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading statistics"
    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full"
  >
    <div className="h-6 w-40 bg-[var(--card-muted)] rounded mb-6 animate-pulse" aria-hidden="true" />
    <div className="grid grid-cols-2 gap-4" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-[var(--card-muted)] rounded-lg animate-pulse" />
      ))}
    </div>
  </div>
);

export const SkeletonCard = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading widget"
    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm min-h-[200px]"
  >
    <div className="h-6 w-48 bg-[var(--card-muted)] rounded mb-4 animate-pulse" aria-hidden="true" />
    <div className="h-40 bg-[var(--card-muted)] rounded animate-pulse" aria-hidden="true" />
  </div>
);

export const ContributionHeatmapSkeleton = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading contribution heatmap"
    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full"
  >
    <div className="h-6 w-48 bg-[var(--card-muted)] rounded mb-6 animate-pulse" aria-hidden="true" />
    <div className="grid grid-cols-7 gap-1" aria-hidden="true">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-sm bg-[var(--card-muted)] animate-pulse" />
      ))}
    </div>
  </div>
);

const WeeklyProgressSummary = dynamic(
  () => import("@/components/WeeklyProgressSummary"),
  { ssr: false, loading: () => <SkeletonCard /> },
);

const CodingActivityInsightsCard = dynamic(
  () => import("@/components/CodingActivityInsightsCard"),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const FriendComparison = dynamic(() => import("@/components/FriendComparison"), {
  ssr: false,
  loading: () => <RepoWidgetSkeleton />,
});

const GitHubAchievementProgress = dynamic(
  () => import("@/components/GitHubAchievementProgress"),
  { ssr: false, loading: () => <SkeletonCard /> },
);

const ActivityRingChart = dynamic(
  () => import("@/components/ActivityRingChart"),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const ContributionGraph = dynamic(
  () => import("@/components/ContributionGraph"),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const ContributionHeatmap = dynamic(
  () => import("@/components/ContributionHeatmap"),
  { ssr: false, loading: () => <ContributionHeatmapSkeleton /> },
);

const RepoContributionDistribution = dynamic(
  () => import("@/components/RepoContributionDistribution"),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const PRMetrics = dynamic(() => import("@/components/PRMetrics"), {
  ssr: false,
  loading: () => <StatsGridSkeleton />,
});

const PRBreakdownChart = dynamic(() => import("@/components/PRBreakdownChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const CommitTimeChart = dynamic(() => import("@/components/CommitTimeChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

const PRReviewTrendChart = dynamic(
  () => import("@/components/PRReviewTrendChart"),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const ProductiveHoursWidget = dynamic(
  () => import("@/components/ProductiveHoursWidget"),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const AchievementProgressTracker = dynamic(
  () => import("@/components/AchievementProgressTracker"),
  { ssr: false, loading: () => <SkeletonCard /> },
);

const SponsorAnalytics = dynamic(
  () => import("@/components/SponsorAnalytics"),
  { ssr: false, loading: () => <SkeletonCard /> },
);

const SECTION_ANCHOR_IDS: Record<DashboardSectionId, string> = {
  overview: "overview",
  activity: "streaks",
  analytics: "pull-requests",
  goals: "goals",
};

const SECTION_ACCENT_CLASSES: Record<DashboardSectionId, string> = {
  overview: "h-1 bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/60 rounded-full shadow-md",
  activity: "h-1 bg-gradient-to-r from-emerald-500 to-emerald-500/60 rounded-full shadow-md",
  analytics: "h-1 bg-gradient-to-r from-blue-500 to-blue-500/60 rounded-full shadow-md",
  goals: "h-1 bg-gradient-to-r from-purple-500 to-purple-500/60 rounded-full shadow-md",
};

const SECTION_GRID_CLASSES: Record<DashboardSectionId, string> = {
  // xl: breakpoints are required here — not just for capping column width,
  // but because WIDGET_SPAN_CLASSES uses xl:col-span-2 on several widgets.
  // Without an explicit xl:grid-cols-N, those col-span rules have no effect
  // and the rendered layout diverges from the skeleton at viewports ≥1280px.
  overview: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6 w-full",
  activity: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 w-full",
  analytics: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 w-full",
  goals: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 w-full",
};

const WIDGET_SPAN_CLASSES: Partial<Record<DashboardWidgetId, string>> = {
  "weekly-summary": "xl:col-span-2",
  "contribution-graph": "xl:col-span-2",
  "commit-heatmap-time": "xl:col-span-2",
  "repo-analytics": "lg:col-span-2",
  "issue-metrics": "xl:col-span-2",
  "goal-tracker": "xl:col-span-2",
  "daily-note": "xl:col-span-2",
  "recent-activity": "xl:col-span-2",
  "sponsor-analytics": "xl:col-span-2",
};

const isDashboardWidgetId = (
  value: UniqueIdentifier,
): value is DashboardWidgetId =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(DASHBOARD_WIDGET_LABELS, value);

const findWidgetSection = (
  layout: DashboardLayoutPreference,
  widgetId: DashboardWidgetId,
): DashboardSectionId | null => {
  for (const sectionId of DASHBOARD_SECTIONS) {
    if (layout.widgets[sectionId].includes(widgetId)) {
      return sectionId;
    }
  }

  return null;
};

const renderDashboardWidget = (widgetId: DashboardWidgetId): ReactNode => {
  switch (widgetId) {
    case "weekly-summary":
      return <WeeklySummaryCard />;
    case "weekly-progress-summary":
      return <WeeklyProgressSummary />;
    case "personal-records":
      return <PersonalRecords />;

    case "ai-mentor":
      return <AIMentorWidget />;

    case "contribution-graph":
      return (
        <div className="w-full overflow-x-auto pb-2">
          <WidgetErrorBoundary>
            <ContributionGraph />
          </WidgetErrorBoundary>
        </div>
      );

    case "contribution-heatmap":
      return (
        <div className="w-full overflow-x-auto pb-2">
          <ContributionHeatmap />
        </div>
      );

    case "repo-contribution-distribution":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <RepoContributionDistribution />
        </LazyWidget>
      );

    case "activity-ring":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <ActivityRingChart />
        </LazyWidget>
      );

    case "coding-activity-insights":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <CodingActivityInsightsCard />
        </LazyWidget>
      );

    case "streak-tracker":
      return <StreakTracker />;

    case "consistency-score":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <ConsistencyScoreWidget />
        </LazyWidget>
      );

    case "local-coding-time":
      return <LocalCodingTime />;

    case "coding-time":
      return <CodingTimeWidget />;

    case "commit-time":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <CommitTimeChart />
        </LazyWidget>
      );

    case "commit-heatmap-time":
      return (
        <LazyWidget fallback={<SkeletonCard />}>
          <CommitHeatmap />
        </LazyWidget>
      );

    case "productive-hours":
      return <ProductiveHoursWidget />;

    case "repo-analytics":
      return (
        <LazyWidget fallback={<RepoWidgetSkeleton />}>
          <RepoAnalyticsExplorer />
        </LazyWidget>
      );

    case "pr-metrics":
      return <PRMetrics />;

    case "pr-breakdown":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <PRBreakdownChart />
        </LazyWidget>
      );

    case "pr-review-trend":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <PRReviewTrendChart />
        </LazyWidget>
      );

    case "discussions":
      return (
        <LazyWidget fallback={<RepoWidgetSkeleton />}>
          <DiscussionsWidget />
        </LazyWidget>
      );

    case "community-metrics":
      return <CommunityMetrics />;

    case "pinned-repos":
      return (
        <LazyWidget fallback={<RepoWidgetSkeleton />}>
          <PinnedReposWidget />
        </LazyWidget>
      );

    case "top-repos":
      return (
        <LazyWidget fallback={<RepoWidgetSkeleton />}>
          <TopRepos />
        </LazyWidget>
      );

    case "inactive-repos":
      return (
        <LazyWidget fallback={<RepoWidgetSkeleton />}>
          <InactiveRepositoriesCard />
        </LazyWidget>
      );

    case "issue-metrics":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <IssueMetrics />
        </LazyWidget>
      );

    case "goal-tracker":
      return (
        <WidgetErrorBoundary>
          <GoalTracker />
        </WidgetErrorBoundary>
      );

    case "daily-note":
      return <DailyNoteWidget />;

    case "recent-activity":
      return (
        <LazyWidget fallback={<RepoWidgetSkeleton />}>
          <RecentActivity />
        </LazyWidget>
      );

    case "ci-analytics":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <CIAnalytics />
        </LazyWidget>
      );

    case "language-breakdown":
      return (
        <LazyWidget fallback={<ChartSkeleton />}>
          <LanguageBreakdown />
        </LazyWidget>
      );

    case "friend-comparison":
      return (
        <LazyWidget fallback={<RepoWidgetSkeleton />}>
          <FriendComparison />
        </LazyWidget>
      );

    case "achievement-progress":
      return (
        <LazyWidget fallback={<SkeletonCard />}>
          <GitHubAchievementProgress />
        </LazyWidget>
      );

    case "sponsor-analytics":
      return (
        <WidgetErrorBoundary>
          <SponsorAnalytics />
        </WidgetErrorBoundary>
      );

    default:
      return null;
  }
};

export default function CustomizableDashboard() {
  const [layout, setLayout] = useState<DashboardLayoutPreference>(() =>
    getDefaultDashboardLayout(),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasLoadedRemoteLayout, setHasLoadedRemoteLayout] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    try {
      const savedLayout = window.localStorage.getItem(
        DASHBOARD_LAYOUT_STORAGE_KEY,
      );

      if (savedLayout) {
        setLayout(normalizeDashboardLayout(JSON.parse(savedLayout)));
      }
    } catch {
      setLayout(getDefaultDashboardLayout());
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRemoteLayout = async () => {
      try {
        const response = await fetch("/api/user/dashboard-layout", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { layout?: unknown };

        if (isMounted && data.layout) {
          setLayout(normalizeDashboardLayout(data.layout));
        }
      } catch {
        // Keep localStorage layout when remote sync is unavailable.
      } finally {
        if (isMounted) {
          setHasLoadedRemoteLayout(true);
        }
      }
    };

    loadRemoteLayout();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    window.localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify(layout),
    );
  }, [isHydrated, layout]);

  const visibleWidgetCount = useMemo(
    () =>
      DASHBOARD_SECTIONS.reduce(
        (count, sectionId) => count + layout.widgets[sectionId].length,
        0,
      ),
    [layout],
  );

  useEffect(() => {
    if (!isHydrated || !hasLoadedRemoteLayout) return;

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      fetch("/api/user/dashboard-layout", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ layout }),
        signal: controller.signal,
      }).catch(() => {
        // Local persistence already succeeded; remote sync can retry later.
      });
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [hasLoadedRemoteLayout, isHydrated, layout]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const activeWidgetId = active.id;
    const overWidgetId = over.id;

    if (
      !isDashboardWidgetId(activeWidgetId) ||
      !isDashboardWidgetId(overWidgetId)
    ) {
      return;
    }

    setLayout((currentLayout) => {
      const fromSection = findWidgetSection(currentLayout, activeWidgetId);
      const toSection = findWidgetSection(currentLayout, overWidgetId);

      if (!fromSection || !toSection) {
        return currentLayout;
      }

      const overIndex = currentLayout.widgets[toSection].indexOf(overWidgetId);

      return moveWidget(
        currentLayout,
        fromSection,
        toSection,
        activeWidgetId,
        overIndex,
      );
    });
  };

  const handleHideWidget = (widgetId: DashboardWidgetId) => {
    setLayout((currentLayout) => hideWidget(currentLayout, widgetId));
  };

  const handleShowWidget = (widgetId: DashboardWidgetId) => {
    setLayout((currentLayout) => showWidget(currentLayout, widgetId));
  };

  const handleResetLayout = () => {
    setLayout(resetDashboardLayout());
  };

  return (
    <div className="mt-10 px-0.5">
      <DashboardLayoutToolbar
        isEditing={isEditing}
        hiddenWidgets={layout.hidden}
        onEditingChange={setIsEditing}
        onReset={handleResetLayout}
        onShowWidget={handleShowWidget}
      />

      <p className="sr-only" aria-live="polite">
        {isEditing
          ? `Layout editing enabled. ${visibleWidgetCount} widgets are visible.`
          : "Layout editing disabled."}
      </p>

      <DashboardWidgetA11yProvider>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {layout.sections.map((sectionId) => {
            const sectionWidgets = layout.widgets[sectionId];

            return (
              <section
                key={sectionId}
                id={SECTION_ANCHOR_IDS[sectionId]}
                className={`scroll-mt-28 ${sectionId === "goals" ? "mb-16" : "mb-14"
                  }`}
              >
                <div className="space-y-2 mb-6">
                  <div
                    className={`w-12 ${SECTION_ACCENT_CLASSES[sectionId]}`}
                  />
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
                      {DASHBOARD_SECTION_LABELS[sectionId]}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)] font-medium">
                      {sectionId === "overview" && "Quick summary of your development profile"}
                      {sectionId === "activity" && "Your coding patterns and contributions"}
                      {sectionId === "analytics" && "In-depth analysis of your repositories and code"}
                      {sectionId === "goals" && "Track progress, milestones, and insights"}
                    </p>
                  </div>
                </div>

                <SortableContext
                  items={sectionWidgets}
                  strategy={rectSortingStrategy}
                >
                  <div className={`${SECTION_GRID_CLASSES[sectionId]} auto-rows-max`}>
                    {sectionWidgets.map((widgetId) => (
                      <SortableDashboardWidget
                        key={widgetId}
                        id={widgetId}
                        title={DASHBOARD_WIDGET_LABELS[widgetId]}
                        isEditing={isEditing}
                        onHide={handleHideWidget}
                        className={WIDGET_SPAN_CLASSES[widgetId] ?? ""}
                      >
                        {renderDashboardWidget(widgetId)}
                      </SortableDashboardWidget>
                    ))}
                  </div>
                </SortableContext>
              </section>
            );
          })}
        </DndContext>
      </DashboardWidgetA11yProvider>
    </div>
  );
}