"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
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

    const url =
      selectedAccount !== null
        ? `/api/metrics/issues?accountId=${encodeURIComponent(selectedAccount)}`
        : "/api/metrics/issues";

    fetch(url)
      .then(async (r) => {
        // A rate-limited or failed response is JSON too; rendering it showed
        // "undefined" and "NaN fewer than last month".
        if (r.status === 429)
          throw new Error(
            "GitHub is rate limiting your account right now. Try again in a few minutes."
          );
        const data = (await r.json()) as Partial<IssueData>;
        if (!r.ok || typeof data.opened !== "number") throw new Error();
        return data as IssueData;
      })
      .then((data) => setMetrics(data))
      .catch((e: Error) =>
        setError(
          e.message ||
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
        { label: "Opened (30d)", value: metrics.opened, color: "#6ba8ff" },
        { label: "Closed (30d)", value: metrics.closed, color: "#34d399" },
        {
          label: "Still open",
          value: metrics.currentlyOpen,
          color: "#fb923c",
        },
        {
          label: "Avg close time",
          value: `${metrics.avgCloseTimeDays ?? 0}d`,
          color: "#c77dff",
        },
      ]
    : [];

  const trendLabel =
    metrics && Number.isFinite(metrics.trend) && metrics.trend !== 0
      ? metrics.trend > 0
        ? `↑ ${metrics.trend} more than last month`
        : `↓ ${Math.abs(metrics.trend)} fewer than last month`
      : null;

  const trendColor =
    metrics && metrics.trend > 0
      ? "text-green-400"
      : "text-[var(--destructive)]";

  const hasNoIssueData =
    !!metrics &&
    metrics.opened === 0 &&
    metrics.closed === 0 &&
    metrics.currentlyOpen === 0 &&
    metrics.avgCloseTimeDays === 0 &&
    metrics.mostActiveRepo === null;

  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <h2 className="mb-4 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
        Issue Analytics
      </h2>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <span className="sr-only">Loading issue analytics</span>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchMetrics}
            className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-destructive/10"
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 stagger-children">
            {stats.map((stat, idx) => (
              <div
                key={stat.label}
                className="stat-cell min-w-0 p-4 text-center animate-fade-in-up"
                style={{ "--stat-c": stat.color } as CSSProperties}
              >
                <div className="stat-value text-2xl">{stat.value}</div>
                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
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
          <div className="flex items-center justify-between gap-3 border border-dashed border-[var(--border)] px-4 py-3 text-sm">
            <span className="shrink-0 font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              Most active repo
            </span>
            <span
              className="min-w-0 truncate font-medium text-[var(--card-foreground)]"
              title={metrics?.mostActiveRepo ?? undefined}
            >
              {metrics?.mostActiveRepo ?? "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
