"use client";

import { useMemo } from "react";
import { SkeletonBlock } from "./WidgetSkeleton";
import { useDashboardMetrics } from "@/components/dashboard/DashboardMetricsContext";

interface IssueData {
  opened: number;
  closed: number;
  currentlyOpen: number;
  avgCloseTimeDays: number;
  trend: number;
  mostActiveRepo: string | null;
}

export default function IssueMetrics() {
  const { metrics, loading, error, refetch } = useDashboardMetrics();
  const issueData = metrics?.issues ?? null;

  const stats = useMemo(
    () =>
      issueData
        ? [
            { label: "Issues Opened (30d)", value: issueData.opened },
            { label: "Issues Closed (30d)", value: issueData.closed },
            { label: "Currently Open", value: issueData.currentlyOpen },
            { label: "Avg Close Time", value: `${issueData.avgCloseTimeDays}d` },
            { label: "Most Active Repo", value: issueData.mostActiveRepo ?? "—" },
          ]
        : [],
    [issueData],
  );

  const trendLabel =
    issueData && issueData.trend !== 0
      ? issueData.trend > 0
        ? `↑ ${issueData.trend} more than last month`
        : `↓ ${Math.abs(issueData.trend)} fewer than last month`
      : null;

  const trendColor =
    issueData && issueData.trend > 0 ? "text-green-400" : "text-[var(--destructive)]";

  const hasNoIssueData =
    !!issueData &&
    issueData.opened === 0 &&
    issueData.closed === 0 &&
    issueData.currentlyOpen === 0 &&
    issueData.avgCloseTimeDays === 0 &&
    issueData.mostActiveRepo === null;

  return (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
    <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
      Issue Analytics
    </h2>

    {loading ? (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <span className="sr-only">Loading issue analytics</span>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBlock key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    ) : error ? (
      <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
        <p>{error.message ?? String(error)}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
        >
          Try again
        </button>
      </div>
    ) : hasNoIssueData ? (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 text-4xl">🐞</div>

        <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
          No issue activity yet
        </h3>

        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          Open or manage GitHub Issues to see issue analytics and trends here.
        </p>

        <a
          href="https://github.com/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--control)]"
        >
          Explore Issues
        </a>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
        {stats.map((stat, idx) => (
          <div
            key={stat.label}
            className="rounded-lg bg-[var(--control)] p-4 text-center stat-cell animate-fade-in-up"
          >
            <div
              className="text-2xl font-bold text-[var(--accent)] truncate"
              title={String(stat.value)}
            >
              {stat.value}
            </div>

            <div className="mt-1 text-sm text-[var(--muted-foreground)]">
              {stat.label}
            </div>

            {idx === 0 && trendLabel && (
              <div className={`mt-1 text-xs font-medium ${trendColor}`}>
                {trendLabel}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);
}