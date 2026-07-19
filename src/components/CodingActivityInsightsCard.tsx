"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { Skeleton } from "@/components/Skeleton";
import { useAccount } from "@/components/AccountContext";
import {
  formatHourRange,
  type CodingActivityInsight,
} from "@/lib/coding-activity-insights";

const DATA_WINDOW_DAYS = 90;

function formatCommitCount(count: number): string {
  return `${count} commit${count === 1 ? "" : "s"}`;
}

function InsightRow({
  label,
  value,
  ariaLabel,
}: {
  label: string;
  value: string;
  ariaLabel?: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--control)] px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className="mt-1 text-sm font-medium text-[var(--card-foreground)]"
        aria-label={ariaLabel}
      >
        {value}
      </p>
    </div>
  );
}
function TrendBadge({
  direction,
  percentage,
}: {
  direction: "up" | "down" | "stable";
  percentage: number;
}) {
  const styles =
    direction === "up"
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : direction === "down"
        ? "bg-red-500/10 text-red-400 border-red-500/20"
        : "bg-blue-500/10 text-blue-400 border-blue-500/20";

  const label =
    direction === "up"
      ? `↑ ${percentage}% Improving`
      : direction === "down"
        ? `↓ ${percentage}% Declining`
        : "Stable Activity";

  return (
    <div
    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${styles}`} >
      {label}
    </div>
  );
}

function HourTooltip({
  active,
  payload,
}: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const entry = payload[0]?.payload as { hour?: number; count?: number } | undefined;
  if (!entry || typeof entry.hour !== "number") {
    return null;
  }

  const count = entry.count ?? 0;

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--tooltip)] px-3 py-2 text-sm text-[var(--tooltip-foreground)] shadow-lg">
      <div className="font-medium">{formatHourRange(entry.hour)}</div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]">
        {formatCommitCount(count)}
      </div>
    </div>
  );
}

export default function CodingActivityInsightsCard() {
  const { selectedAccount } = useAccount();
  const [timezone, setTimezone] = useState<string | null>(null);
  const [data, setData] = useState<CodingActivityInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
  }, []);

  const fetchInsights = useCallback(() => {
    if (!timezone) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("timeZone", timezone);
    if (selectedAccount !== null) {
      params.set("accountId", selectedAccount);
    }

    fetch(`/api/metrics/coding-activity-insights?${params.toString()}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("API error");
        }
        return response.json();
      })
      .then((payload: CodingActivityInsight) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setData(payload);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setError("We couldn't load your AI Productivity Insights right now. Please try again in a moment.");
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setLoading(false);
      });
  }, [selectedAccount, timezone]);

  useEffect(() => {
    if (!timezone) {
      return;
    }

    fetchInsights();
  }, [fetchInsights, timezone]);

  const chartData = useMemo(
    () => data?.hourlyCounts.map(({ hour, count }) => ({ hour, count })) ?? [],
    [data]
  );

  const hasData = Boolean(
    data && data.totalActivities > 0 && chartData.some((entry) => entry.count > 0)
  );

  const insightRows = useMemo(() => {
    if (!data) {
      return [];
    }

    const rows: { label: string; value: string; ariaLabel?: string }[] = [
      {
        label: "Most active",
        value: `${data.mostActiveHour.label} with ${formatCommitCount(data.mostActiveHour.count)}`,
      },
      {
        label: "Least active",
        value: `${data.leastActiveHour.label} with ${formatCommitCount(data.leastActiveHour.count)}`,
      },
      {
        label: "Consistency",
        value: `${data.consistencyScore ?? 0}% weekly consistency`,
      },

      {
        label: "Productivity",
        value:
          data.productivityLevel === "Excellent"
            ? "🟢 Excellent"
            : data.productivityLevel === "Very Good"
              ? "🔵 Very Good"
              : data.productivityLevel === "Good"
                ? "🟡 Good"
                : data.productivityLevel === "Moderate"
                  ? "🟠 Moderate"
                  : "🔴 Low",
        ariaLabel: `Productivity level: ${data.productivityLevel ?? "Low"}`,
      },

      {
        label: "Daily Average",
        value: `${data.averageDailyCommits ?? 0} commits/day`,
      },
    ];

    if (data.mostActiveDay) {
      rows.push({
        label: "Best day",
        value: `${data.mostActiveDay.day} with ${formatCommitCount(data.mostActiveDay.count)}`,
      });
    }

    return rows;
  }, [data]);

  const dataWindowLabel = `Last ${DATA_WINDOW_DAYS} days`;

  const subtitle = data
    ? `${dataWindowLabel} · Commits by hour · ${data.timezone}`
    : timezone
      ? `${dataWindowLabel} · Commits by hour · ${timezone}`
      : `${dataWindowLabel} · Commits by hour · Local timezone`;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Coding Activity Insights
          </h2>
          {data?.weeklyTrend ? (
            <div className="mt-2">
              <TrendBadge
                direction={data.weeklyTrend.direction}
                percentage={data.weeklyTrend.percentage}
              />
            </div>
          ) : null}
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchInsights}
          disabled={loading}
          aria-label="Refresh coding activity insights"
          className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--control)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Refreshing
            </>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-4"
        >
          <span className="sr-only">Loading coding activity insights</span>
          <Skeleton className="h-[260px] lg:h-[300px] w-full rounded-lg" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchInsights}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      ) : !hasData ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--card-muted)] px-4 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Not enough coding activity was detected to generate AI-powered productivity insights yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-[260px] min-h-[200px] lg:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                  opacity={0.35}
                />
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                  tickFormatter={(value) => String(value)}
                  style={{ fill: "var(--muted-foreground)", fontSize: "0.75rem" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  style={{ fill: "var(--muted-foreground)", fontSize: "0.75rem" }}
                />
                <Tooltip content={HourTooltip} />
                <Bar
                  dataKey="count"
                  fill="var(--accent)"
                  radius={[4, 4, 0, 0]}
                  barSize={10}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div
      className={`grid gap-3 ${
        data?.mostActiveDay
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2"
      }`}
    >
      {insightRows.map((row) => (
        <InsightRow
          key={row.label}
          label={row.label}
          value={row.value}
          ariaLabel={row.ariaLabel}
        />
      ))}
    </div>

    {(data?.summary?.length || data?.recommendations?.length) && (
      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card-muted)] p-4">

        {data.summary?.length ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-[var(--card-foreground)]">
              AI Productivity Summary
            </h3>

            <div className="space-y-2">
              {data.summary.map((item, index) => (
                <div
                  key={index}
                  className="rounded-md bg-[var(--control)] px-3 py-2 text-sm text-[var(--card-foreground)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data.recommendations?.length ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-[var(--card-foreground)]">
              Smart Recommendations
            </h3>

            <div className="space-y-2">
              {data.recommendations.map((item, index) => (
                <div
                  key={index}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted-foreground)]"
                >
                  • {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}

      </div>
    )}
        </div>
      )}
    </div>
  );
}
