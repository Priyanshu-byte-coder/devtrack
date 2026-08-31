"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { useAccount } from "@/components/AccountContext";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-[var(--card-foreground)]">
        {label}
      </p>

      {point.avgReviewDays === null ? (
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          No merged PRs this week
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Avg merge time:{" "}
            <span className="font-semibold text-[var(--card-foreground)]">
              {formatDays(point.avgReviewDays)}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Based on {point.mergedCount} merged PR
            {point.mergedCount === 1 ? "" : "s"}
          </p>
        </>
      )}
    </div>
  );
}

export default function PRReviewTrendChart() {
  const { selectedAccount } = useAccount();

  const [data, setData] = useState<PRReviewTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [githubAuthInvalid, setGithubAuthInvalid] = useState(false);

  const fetchTrend = useCallback(() => {
    setLoading(true);
    setError(null);
    setGithubAuthInvalid(false);

    const url =
      selectedAccount !== null
        ? `/api/metrics/pr-review-time?accountId=${encodeURIComponent(
            selectedAccount
          )}`
        : "/api/metrics/pr-review-time";

    fetch(url)
      .then(async (r) => {
        const body = await r.json();
        if (body?.error === "token_expired") {
          setGithubAuthInvalid(true);
          return null;
        }
        if (!r.ok) throw new Error("API error");
        return body as PRReviewTrendResponse;
      })
      .then((res) => {
        if (!res) return;
        setData(res.weeks ?? []);
      })
      .catch(() => {
        setError(
          "We couldn't load your PR review trend right now. Please try again."
        );
      })
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  const stats = useMemo(() => {
    const validWeeks = data.filter((week) => week.avgReviewDays !== null);
    const totalMerged = data.reduce((sum, week) => sum + week.mergedCount, 0);

    const overallAvg =
      validWeeks.length > 0
        ? validWeeks.reduce(
            (sum, week) => sum + (week.avgReviewDays ?? 0),
            0
          ) / validWeeks.length
        : null;

    const latestValid = [...data]
      .reverse()
      .find((week) => week.avgReviewDays !== null);

    const previousValid = [...data]
      .reverse()
      .filter((week) => week.avgReviewDays !== null)[1];

    let trendText = "Not enough data";
    if (latestValid && previousValid) {
      const diff =
        (latestValid.avgReviewDays ?? 0) - (previousValid.avgReviewDays ?? 0);

      if (Math.abs(diff) < 0.01) {
        trendText = "No major change";
      } else if (diff < 0) {
        trendText = `${Math.abs(diff).toFixed(2)}d faster`;
      } else {
        trendText = `${diff.toFixed(2)}d slower`;
      }
    }

    return {
      totalMerged,
      overallAvg,
      latestAvg: latestValid?.avgReviewDays ?? null,
      trendText,
    };
  }, [data]);

  const hasData = data.some((week) => week.avgReviewDays !== null);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            PR Review Time Trend
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Average time from PR open to merge over the last 12 weeks.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-[var(--card-muted)]"
              />
            ))}
          </div>
          <div className="h-[300px] animate-pulse rounded-lg bg-[var(--card-muted)]" />
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
  {[1,2,3,4,5,6,7,8].map((i) => (
    <div
      key={i}
      className="h-14 rounded-md bg-[var(--card-muted)] animate-pulse"
    />
  ))}
</div>
        </div>
      ) : githubAuthInvalid ? (
        <div className="flex h-[360px] items-center justify-center">
          <div className="max-w-sm rounded-lg border border-[var(--border)] bg-[var(--background)] p-6 text-center space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Your GitHub connection is no longer valid. Reconnect your GitHub
              account to continue syncing data.
            </p>
            <button
              type="button"
              onClick={() => {
                void signOut({ redirect: false }).then(() => {
                  window.location.href = "/api/auth/signin/github?callbackUrl=/dashboard";
                });
              }}
              className="inline-flex items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Reconnect GitHub
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-[360px] items-center justify-center">
          <div className="max-w-sm rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-5 text-center">
            <p className="text-sm text-[var(--destructive)]">{error}</p>
            <button
              type="button"
              onClick={fetchTrend}
              className="mt-4 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
            >
              Try again
            </button>
          </div>
        </div>
      ) : !hasData ? (
        <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-[var(--border)]">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--card-foreground)]">
              No merged PRs found
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Merged PRs are required to calculate review time.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                Overall avg
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--card-foreground)]">
                {formatDays(stats.overallAvg)}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                Latest week
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--card-foreground)]">
                {formatDays(stats.latestAvg)}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                Merged PRs
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--card-foreground)]">
                {stats.totalMerged}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {stats.trendText}
              </p>
            </div>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 16, right: 24, left: 4, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="var(--border)"
                  opacity={0.45}
                />

                <XAxis
  dataKey="label"
  axisLine={false}
  tickLine={false}
  tickMargin={12}
  interval="preserveStartEnd"
  tick={{ fill: "var(--muted-foreground)", fontSize: "0.7rem" }}
/>

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  width={48}
                  domain={[0, "dataMax + 0.5"]}
                  allowDecimals
                  tickFormatter={(value: number) => `${value}d`}
                  style={{
                    fill: "var(--muted-foreground)",
                    fontSize: "0.8rem",
                  }}
                />

                <Tooltip content={<CustomTooltip />} />

                <Line
                  type="monotone"
                  dataKey="avgReviewDays"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  connectNulls={false}
                  dot={(props: any) => {
                    const point = props.payload as PRReviewTrendPoint;

                    if (point.avgReviewDays === null) {
                      return (
                        <circle
                          key={`dot-null-${props.index}`}
                          cx={props.cx}
                          cy={props.cy}
                          r={4}
                          fill="var(--muted-foreground)"
                          opacity={0.35}
                        />
                      );
                    }

                    return (
                      <circle
                        key={`dot-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={5}
                        fill="var(--accent)"
                        stroke="var(--card)"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{
                    r: 7,
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
            {data.map((week) => (
              <div
                key={week.weekStart}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              >
                <p className="text-xs font-medium text-[var(--card-foreground)]">
                  {week.label}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {week.avgReviewDays === null
                    ? "No merged PRs"
                    : `${formatDays(week.avgReviewDays)} · ${
                        week.mergedCount
                      } PR${week.mergedCount === 1 ? "" : "s"}`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
