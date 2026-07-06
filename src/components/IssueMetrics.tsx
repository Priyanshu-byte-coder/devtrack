"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { SkeletonBlock } from "./WidgetSkeleton";

interface IssueData {
  opened: number;
  closed: number;
  currentlyOpen: number;
  avgCloseTimeDays: number;
  trend: number;
  mostActiveRepo: string | null;
}

export default function IssueMetrics() {
  const { selectedAccount } = useAccount();
  const [metrics, setMetrics] = useState<IssueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(() => {
    setLoading(true);
    setError(null);

    const url = selectedAccount !== null
      ? `/api/metrics/issues?accountId=${encodeURIComponent(selectedAccount)}`
      : "/api/metrics/issues";

    fetch(url)
      .then((r) => r.json())
      .then((data: IssueData) => setMetrics(data))
      .catch(() =>
        setError(
          "We couldn't load your Issues analytics right now. Please try again in a moment."
        )
      )
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const stats = metrics
    ? [
        { label: "Issues Opened (30d)", value: metrics.opened },
        { label: "Issues Closed (30d)", value: metrics.closed },
        { label: "Currently Open", value: metrics.currentlyOpen },
        { label: "Avg Close Time", value: `${metrics.avgCloseTimeDays}d` },
        { label: "Most Active Repo", value: metrics.mostActiveRepo ?? "—" },
      ]
    : [];

  const trendLabel =
    metrics && metrics.trend !== 0
      ? metrics.trend > 0
        ? `↑ ${metrics.trend} more than last month`
        : `↓ ${Math.abs(metrics.trend)} fewer than last month`
      : null;

  const trendColor =
    metrics && metrics.trend > 0 ? "text-green-400" : "text-[var(--destructive)]";

   const hasNoIssueData =
  !!metrics &&
  metrics.opened === 0 &&
  metrics.closed === 0 &&
  metrics.currentlyOpen === 0 &&
  metrics.avgCloseTimeDays === 0 &&
  metrics.mostActiveRepo === null;

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
        <p>{error}</p>
        <button
          type="button"
          onClick={fetchMetrics}
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