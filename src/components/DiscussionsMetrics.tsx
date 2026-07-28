"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAccount } from "@/components/AccountContext";
import { SkeletonBlock } from "./WidgetSkeleton";

export interface CategoryCount {
  category: string;
  count: number;
}

export interface DiscussionsMetricsData {
  discussionsStarted: number;
  commentsLeft: number;
  commentsGiven?: number;
  acceptedAnswers: number;
  markedAsAnswer?: number;
  answeredRate: number;
  topCategories: CategoryCount[];
}

export default function DiscussionsMetrics() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<DiscussionsMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("days", days.toString());
    if (selectedAccount !== null) {
      params.set("accountId", selectedAccount);
    }

    fetch(`/api/metrics/discussions?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((d: DiscussionsMetricsData) => setData(d))
      .catch(() =>
        setError("We couldn't load your discussion metrics right now.")
      )
      .finally(() => setLoading(false));
  }, [selectedAccount, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const commentsCount = data ? (data.commentsLeft ?? data.commentsGiven ?? 0) : 0;
  const answeredCount = data ? (data.acceptedAnswers ?? data.markedAsAnswer ?? 0) : 0;

  const stats = data
    ? [
        {
          label: "Discussions Started",
          value: data.discussionsStarted,
          title: "Total discussions you have opened",
        },
        {
          label: "Comments Left",
          value: commentsCount,
          title: "Discussions comments you have posted",
        },
        {
          label: "Answered Rate",
          value: `${data.answeredRate ?? 0}%`,
          subtext: `${answeredCount} answered`,
          title: "Percentage of discussions marked as answered",
        },
      ]
    : [];

  const hasNoDiscussionData =
    !!data &&
    data.discussionsStarted === 0 &&
    commentsCount === 0 &&
    answeredCount === 0;

  const chartData = data?.topCategories && data.topCategories.length > 0
    ? data.topCategories.map((c) => ({
        category: c.category,
        count: c.count,
      }))
    : [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Discussion Activity
        </h2>
        <div className="flex items-center gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                days === d
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--control)] text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-4"
        >
          <span className="sr-only">Loading discussion metrics</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <SkeletonBlock className="h-44 rounded-lg w-full mt-4" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      ) : hasNoDiscussionData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
          <div className="mb-3 text-4xl">💬</div>
          <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
            No discussion activity yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            Participate in GitHub Discussions during the last {days} days to see your activity and category breakdown here.
          </p>
          <a
            href="https://github.com/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--control)] transition-colors"
          >
            Explore Discussions
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-[var(--control)] p-4 text-center stat-cell animate-fade-in-up flex flex-col justify-center"
                title={stat.title}
              >
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {stat.label}
                </div>
                {stat.subtext && (
                  <div className="mt-0.5 text-xs text-[var(--muted-foreground)]/80">
                    {stat.subtext}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col flex-1 min-h-[180px]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
              Top Categories
            </h3>
            {chartData.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--muted-foreground)]">
                No discussion category data for this time period.
              </div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="var(--border)"
                      opacity={0.4}
                    />
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis
                      type="category"
                      dataKey="category"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={8}
                      style={{ fill: "var(--muted-foreground)", fontSize: "0.75rem" }}
                      width={90}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--card-muted)", opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        color: "var(--card-foreground)",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                      }}
                      itemStyle={{ color: "var(--accent)" }}
                    />
                    <Bar
                      dataKey="count"
                      name="Discussions"
                      fill="var(--accent)"
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
