"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

interface PRReviewTrendPoint {
  weekStart: string;
  label: string;
  avgReviewDays: number | null;
  mergedCount: number;
}

interface PRReviewTrendResponse {
  weeks: PRReviewTrendPoint[];
}

function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined) return "No data";
  if (value < 1) return `${(value * 24).toFixed(1)}h`;
  return `${value.toFixed(2)}d`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as PRReviewTrendPoint;

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-[var(--card-foreground)]">
        {label}
      </p>
      {point.avgReviewDays === null ? (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">No PRs</p>
      ) : (
        <p className="mt-1 text-xs text-[var(--card-foreground)]">
          {formatDays(point.avgReviewDays)} ({point.mergedCount} PR{point.mergedCount > 1 ? "s" : ""})
        </p>
      )}
    </div>
  );
}

export default function MiniPRTrendChart() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<PRReviewTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrend = useCallback(() => {
    setLoading(true);
    const url =
      selectedAccount !== null
        ? `/api/metrics/pr-review-time?accountId=${encodeURIComponent(selectedAccount)}`
        : "/api/metrics/pr-review-time";

    fetch(url)
      .then((r) => r.ok ? r.json() : { weeks: [] })
      .then((res: PRReviewTrendResponse) => setData(res.weeks ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  const stats = useMemo(() => {
    const validWeeks = data.filter((week) => week.avgReviewDays !== null);
    const totalMerged = data.reduce((sum, week) => sum + week.mergedCount, 0);

    const latestValid = validWeeks[validWeeks.length - 1];
    const previousValid = validWeeks[validWeeks.length - 2];

    let trendColor = "text-[var(--muted-foreground)]";
    let trendBg = "bg-[var(--control)]";
    let trendText = "Stable";

    if (latestValid && previousValid) {
      const diff = (latestValid.avgReviewDays ?? 0) - (previousValid.avgReviewDays ?? 0);
      if (Math.abs(diff) < 0.01) {
        trendText = "Stable";
      } else if (diff < 0) {
        trendText = "Improving";
        trendColor = "text-green-600 dark:text-green-400";
        trendBg = "bg-green-100 dark:bg-green-900/20";
      } else {
        trendText = "Degrading";
        trendColor = "text-red-600 dark:text-red-400";
        trendBg = "bg-red-100 dark:bg-red-900/20";
      }
    }

    return { totalMerged, trendText, trendColor, trendBg };
  }, [data]);

  if (loading) {
  return (
    <div className="mt-4 flex h-16 w-full items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--control)] p-3">
      <div className="flex flex-col gap-1 w-24">
        <div className="h-3 w-16 rounded bg-[var(--card-muted)] animate-pulse" />
        <div className="h-4 w-20 rounded bg-[var(--card-muted)] animate-pulse" />
      </div>

      <div className="flex-1 h-full rounded bg-[var(--card-muted)] animate-pulse" />
    </div>
  );
}

  if (stats.totalMerged < 5) {
    return (
      <div className="mt-4 flex h-16 items-center justify-center rounded border border-dashed border-[var(--border)]">
        <p className="text-xs text-[var(--muted-foreground)]">
          Need at least 5 merged PRs to show review trend
        </p>
      </div>
    );
  }

  let strokeColor = "var(--accent)";
  if (stats.trendText === "Improving") strokeColor = "var(--success)";
  if (stats.trendText === "Degrading") strokeColor = "var(--destructive)";

  return (
    <div className="mt-4 flex h-16 w-full items-center justify-between gap-4 rounded-lg bg-[var(--control)] p-3 border border-[var(--border)] transition-colors duration-200 hover:bg-[var(--card-muted)]">
      <div className="flex flex-col gap-1 w-24">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">12w Trend</span>
        <span className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${stats.trendBg} ${stats.trendColor}`}>
          {stats.trendText}
        </span>
      </div>
      <div className="h-full flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} hide />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line
              type="monotone"
              dataKey="avgReviewDays"
              stroke={strokeColor}
              strokeWidth={2}
              dot={{ r: 0 }}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 1 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
