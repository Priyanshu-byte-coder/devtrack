"use client";

import { metricCount, metricWithUnit } from "@/lib/format-metric";
import SectionHeader from "./SectionHeader";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useAccount } from "@/components/AccountContext";
import { useDashboardWidgetA11y } from "@/components/dashboard/DashboardWidgetA11yContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import PRStatusDonutChart from "./PRStatusDonutChart";
import MiniPRTrendChart from "./MiniPRTrendChart";
import { SkeletonBlock } from "./WidgetSkeleton";
import { safeExternalHref } from "@/lib/safe-url";
import { arcadeTabClass, arcadeTabGroupClass } from "@/components/ui/arcade";

interface PRMetricsSummary {
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

interface PRData extends PRMetricsSummary {
  gitlab?: PRMetricsSummary;
  reviews?: {
    totalReviews: number;
    approvalRate: string;
    topRepos: { repo: string; count: number }[];
  };
}

interface PRStat {
  label: string;
  value: string | number;
  title?: string;
  warning?: boolean;
  href?: string;
}

function formatReviewCycle(hours: number | null | undefined): string {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return "—";
  if (hours < 24) return `${hours}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

/** Colour keys for the stat tiles, in the HUD palette. */
const STAT_COLORS = [
  "#6ba8ff",
  "#34d399",
  "#c77dff",
  "#fb923c",
  "#f2c14e",
  "#22d3ee",
];

export default function PRMetrics() {
  const { selectedAccount } = useAccount();
  const [metrics, setMetrics] = useState<PRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = usePersistentState<"authored" | "reviews">(
    "devtrack:pr-metrics:activeTab",
    "authored"
  );
  const [prFilter, setPrFilter] = usePersistentState<"all" | "merged" | "open">(
    "devtrack:pr-metrics:prFilter",
    "all"
  );
  const [range, setRange] = usePersistentState<"7d" | "30d" | "90d">(
    "devtrack:pr-metrics:range",
    "30d"
  );
  const [staleThresholdDays, setStaleThresholdDays] = usePersistentState(
    "devtrack:pr-metrics:staleThreshold",
    14
  );

  const fetchMetrics = useCallback(() => {
    setLoading(true);
    setError(null);

    const url =
      selectedAccount !== null
        ? `/api/metrics/prs?accountId=${encodeURIComponent(selectedAccount)}&range=${range}`
        : `/api/metrics/prs?range=${range}`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((data: PRData) => {
        setMetrics(data);
        setLastUpdated(new Date());
        setMinutesAgo(0);
      })
      .catch(() =>
        setError(
          "We couldn't load your PR analytics right now. Please try again in a moment."
        )
      )
      .finally(() => setLoading(false));
  }, [selectedAccount, range]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
      setMinutesAgo(diff);
    }, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const buildStats = (
    source: PRMetricsSummary,
    labels: {
      open: string;
      merged: string;
      avgReview: string;
      avgFirstReview: string;
      mergeRate: string;
      avgCycleTime?: string;
    }
  ) => {
    const baseStats: PRStat[] = [
      { label: labels.open, value: metricCount(source.open) },
      { label: labels.merged, value: metricCount(source.merged) },
      {
        label: "Lines Changed",
        value: `+${(source.totalAdditions ?? 0).toLocaleString()} / -${(source.totalDeletions ?? 0).toLocaleString()}`,
      },
      {
        label: `${labels.avgReview} ⓘ`,
        value: metricWithUnit(source.avgReviewHours, "h"),
        title:
          "Average time from PR creation to close, based on your last 30 closed PRs",
      },
      {
        label: labels.avgFirstReview,
        value: formatReviewCycle(source.avgFirstReviewHours),
        title: "Average time from PR open to first review comment or approval",
      },
      { label: labels.mergeRate, value: source.mergeRate ?? "—" },
    ];

    if (labels.avgCycleTime && source.avgCycleTime !== undefined) {
      baseStats.push({
        label: labels.avgCycleTime,
        value: metricWithUnit(source.avgCycleTime, "h"),
      });
    }
    return baseStats;
  };

  const githubStats = metrics
    ? buildStats(metrics, {
        open: "Open PRs",
        merged: `Merged (${range})`,
        avgReview: "Avg Review Time",
        avgFirstReview: "Avg First Review",
        mergeRate: "Merge Rate",
        avgCycleTime: "Avg Cycle Time",
      })
    : [];

  const gitlabStats = metrics?.gitlab
    ? buildStats(metrics.gitlab, {
        open: "Open MRs",
        merged: `Merged (${range})`,
        avgReview: "Avg Review Time",
        avgFirstReview: "Avg First Review",
        mergeRate: "Merge Rate",
      })
    : [];

  const renderStat = (stat: PRStat, index: number) => {
    const content = (
      <>
        <div className="stat-value truncate text-xl">{stat.value}</div>
        <div className="truncate mt-1 text-xs text-[var(--muted-foreground)]">
          {stat.label}
        </div>
      </>
    );

    const className = "stat-cell block min-w-0 p-4 text-center";
    const style = {
      "--stat-c": stat.warning
        ? "#fb923c"
        : STAT_COLORS[index % STAT_COLORS.length],
    } as CSSProperties;

    return stat.href ? (
      <a
        key={stat.label}
        href={safeExternalHref(stat.href)}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        title={stat.title}
      >
        {content}
      </a>
    ) : (
      <div
        key={stat.label}
        className={className}
        style={style}
        title={stat.title}
      >
        {content}
      </div>
    );
  };

  return (
    <div className="px-frame bg-[var(--card)] p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
        <SectionHeader title="PR Analytics" />
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={arcadeTabGroupClass}
            role="group"
            aria-label="Time range"
          >
            {(["7d", "30d", "90d"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                aria-pressed={range === option}
                className={arcadeTabClass(range === option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className={arcadeTabGroupClass} role="group" aria-label="View">
            <button
              type="button"
              onClick={() => setActiveTab("authored")}
              aria-pressed={activeTab === "authored"}
              className={arcadeTabClass(activeTab === "authored")}
            >
              Authored
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              aria-pressed={activeTab === "reviews"}
              className={arcadeTabClass(activeTab === "reviews")}
            >
              Reviews
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
            Stale after
            <select
              value={staleThresholdDays}
              onChange={(event) =>
                setStaleThresholdDays(Number(event.target.value))
              }
              className="rounded-md border border-[var(--border)] bg-[var(--control)] px-2 py-1 text-sm text-[var(--foreground)] transition-colors"
            >
              {[7, 14, 30].map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-4"
        >
          <span className="sr-only">Loading PR analytics</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkeletonBlock key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <SkeletonBlock className="h-[270px] rounded-lg" />
          <SkeletonBlock className="h-[220px] rounded-lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <p>{error}</p>
          <button
            onClick={fetchMetrics}
            className="mt-3 rounded-md px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 border border-red-500/30"
          >
            Try again
          </button>
        </div>
      ) : activeTab === "authored" ? (
        <div className="space-y-6">
          {/* GitHub Stats */}
          <div>
            <div className="flex flex-wrap items-center justify-between mb-4">
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                GitHub PRs
              </p>
              <div className="flex items-center gap-2">
                {(["all", "merged", "open"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPrFilter(filter)}
                    aria-pressed={prFilter === filter}
                    className={arcadeTabClass(prFilter === filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              {githubStats
                .filter((stat) => {
                  if (prFilter === "all") return true;
                  const lbl = stat.label.toLowerCase();
                  if (prFilter === "open")
                    return lbl.includes("open") || lbl.includes("stale");
                  if (prFilter === "merged")
                    return (
                      lbl.includes("merged") ||
                      lbl.includes("review") ||
                      lbl.includes("merge rate")
                    );
                  return true;
                })
                .map(renderStat)}
            </div>
            {prFilter !== "open" && <MiniPRTrendChart />}
          </div>

          {/* PR Status Donut Chart */}
          {metrics && (
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">
                PR Status Distribution
              </p>
              <PRStatusDonutChart
                open={prFilter === "merged" ? 0 : metrics.open || 0}
                merged={prFilter === "open" ? 0 : metrics.merged || 0}
                closed={prFilter === "all" ? metrics.closed || 0 : 0}
              />
            </div>
          )}

          {/* Cycle Time Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics?.weeklyTrend && metrics.weeklyTrend.length > 0 && (
              <div className="rounded-lg bg-[var(--control)] p-4">
                <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-3">
                  Review Cycle Trend
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={metrics.weeklyTrend}>
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="h" />
                    <Tooltip
                      formatter={(val) => [`${val}h`, "Avg Cycle Time"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgHours"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {metrics?.slowestRepos && metrics.slowestRepos.length > 0 && (
              <div className="rounded-lg bg-[var(--control)] p-4">
                <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-3">
                  Slowest Review Repos
                </h3>
                <div className="space-y-2">
                  {metrics.slowestRepos.map((r) => (
                    <div
                      key={r.repo}
                      className="flex justify-between items-center bg-[var(--card)] p-2 rounded"
                    >
                      <span className="text-sm text-[var(--muted-foreground)] truncate">
                        {r.repo}
                      </span>
                      <span className="text-sm font-bold text-[var(--accent)]">
                        {r.avgHours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GitLab MRs Section */}
          {metrics?.gitlab && (
            <div className="space-y-4 border-t border-[var(--border)] pt-4">
              <p className="text-sm font-medium text-[var(--muted-foreground)]">
                GitLab MRs
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gitlabStats
                  .filter((stat) => {
                    if (prFilter === "all") return true;
                    const lbl = stat.label.toLowerCase();
                    if (prFilter === "open")
                      return lbl.includes("open") || lbl.includes("stale");
                    if (prFilter === "merged")
                      return (
                        lbl.includes("merged") ||
                        lbl.includes("review") ||
                        lbl.includes("merge rate")
                      );
                    return true;
                  })
                  .map(renderStat)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: "Total Reviews Given",
                value: metrics?.reviews?.totalReviews ?? 0,
              },
              {
                label: "Approval Rate",
                value: metrics?.reviews?.approvalRate ?? "0%",
              },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="stat-cell p-4 text-center"
                style={
                  {
                    "--stat-c": STAT_COLORS[index % STAT_COLORS.length],
                  } as CSSProperties
                }
              >
                <div className="stat-value text-2xl">{stat.value}</div>
                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastUpdated && (
        <p className="text-xs text-[var(--muted-foreground)] mt-2 text-right">
          {minutesAgo === 0
            ? "Updated just now"
            : `Updated ${minutesAgo} min ago`}
        </p>
      )}
    </div>
  );
}
