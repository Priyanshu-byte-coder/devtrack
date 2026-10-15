"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "./ThemeContext";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RepoChartItem = {
  name: string;
  commits: number;
  percentage: number;
};

type ChartType = "pie" | "bar";

type ChartTooltipPayload = {
  payload?: RepoChartItem;
  value?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function getStringValue(
  record: Record<string, unknown>,
  keys: string[],
  fallback: string
) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

function getNumberValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function getRepoArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const record = asRecord(payload);

  if (Array.isArray(record.repos)) return record.repos;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.repositories)) return record.repositories;

  return [];
}

function normalizeRepos(payload: unknown): RepoChartItem[] {
  const repos = getRepoArray(payload);

  const mapped = repos
    .map((item) => {
      const repo = asRecord(item);

      const name = getStringValue(
        repo,
        ["name", "repo", "repository", "full_name", "fullName"],
        "Unknown repository"
      );

      const commits = getNumberValue(repo, [
        "commits",
        "commitCount",
        "contributions",
        "count",
        "totalCommits",
      ]);

      return { name, commits };
    })
    .filter((repo) => repo.commits > 0)
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 8);

  const total = mapped.reduce((sum, repo) => sum + repo.commits, 0);

  return mapped.map((repo) => ({
    ...repo,
    percentage:
      total > 0 ? Number(((repo.commits / total) * 100).toFixed(1)) : 0,
  }));
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
}) {
  if (!active || !payload?.length || !payload[0]?.payload) {
    return null;
  }

  const repo = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm shadow-lg">
      <p className="font-medium text-[var(--card-foreground)]">{repo.name}</p>
      <p className="text-[var(--muted-foreground)]">{repo.commits} commits</p>
      <p className="text-[var(--muted-foreground)]">
        {repo.percentage}% contribution
      </p>
    </div>
  );
}

export default function RepoContributionDistribution({
  days = 365,
}: {
  days?: number;
}) {
  const { theme } = useTheme();
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const resolvedColors = [
      style.getPropertyValue("--accent").trim() || "var(--accent)",
      style.getPropertyValue("--chart-2").trim() || "var(--chart-2)",
      style.getPropertyValue("--chart-3").trim() || "var(--chart-3)",
      style.getPropertyValue("--chart-4").trim() || "var(--chart-4)",
      style.getPropertyValue("--chart-5").trim() || "var(--chart-5)",
      style.getPropertyValue("--chart-6").trim() || "var(--chart-6)",
      style.getPropertyValue("--chart-7").trim() || "var(--chart-7)",
      style.getPropertyValue("--chart-8").trim() || "var(--chart-8)",
    ];
    setColors(resolvedColors);
  }, [theme]);

  const activeColors =
    colors.length > 0
      ? colors
      : [
          "var(--accent)",
          "var(--chart-2)",
          "var(--chart-3)",
          "var(--chart-4)",
          "var(--chart-5)",
          "var(--chart-6)",
          "var(--chart-7)",
          "var(--chart-8)",
        ];

  const [data, setData] = useState<RepoChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartType, setChartType] = useState<ChartType>("pie");

  useEffect(() => {
    let cancelled = false;

    async function loadRepos() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/metrics/repos?days=${days}`);

        if (!response.ok) {
          throw new Error("Failed to fetch repository metrics.");
        }

        const payload: unknown = await response.json();
        const normalized = normalizeRepos(payload);

        if (!cancelled) {
          setData(normalized);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load repository chart."
          );
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRepos();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const totalCommits = useMemo(
    () => data.reduce((sum, repo) => sum + repo.commits, 0),
    [data]
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Repository Contribution Distribution
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Repo-wise contribution share based on recent commit activity.
          </p>
        </div>

        <div className="flex w-fit rounded-lg border border-[var(--border)] bg-[var(--control)] p-1 text-sm">
          <button
            type="button"
            onClick={() => setChartType("pie")}
            className={`rounded-md px-3 py-1 transition ${
              chartType === "pie"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            Pie
          </button>
          <button
            type="button"
            onClick={() => setChartType("bar")}
            className={`rounded-md px-3 py-1 transition ${
              chartType === "bar"
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "text-[var(--muted-foreground)]"
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)]">
          Loading repository distribution...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--destructive)] bg-[var(--card)] p-4 text-sm text-[var(--destructive)]">
          {error}
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)]">
          No repository contribution data available yet.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-3">
              <p className="text-xs text-[var(--muted-foreground)]">
                Repositories
              </p>
              <p className="text-lg font-semibold text-[var(--card-foreground)] sm:text-xl">
                {data.length}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--control)] p-3">
              <p className="text-xs text-[var(--muted-foreground)]">
                Total commits
              </p>
              <p className="text-lg font-semibold text-[var(--card-foreground)] sm:text-xl">
                {totalCommits}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--control)] p-3">
              <p className="text-xs text-[var(--muted-foreground)]">Top repo</p>
              <p
                className="truncate text-lg font-semibold text-[var(--card-foreground)] sm:text-xl"
                title={data[0]?.name}
              >
                {data[0]?.name.split("/").pop()}
              </p>
            </div>
          </div>

          <div className={chartType === "pie" ? "h-64 w-full" : "h-80 w-full"}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "pie" ? (
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="commits"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                  >
                    {data.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={activeColors[index % activeColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              ) : (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="commits" radius={[6, 6, 0, 0]}>
                    {data.map((_, index) => (
                      <Cell
                        key={`bar-${index}`}
                        fill={activeColors[index % activeColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {chartType === "pie" && (
            <ul className="mt-4 space-y-2" aria-label="Commits per repository">
              {data.map((repo, index) => (
                <li
                  key={repo.name}
                  className="flex min-w-0 items-center gap-3 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{
                      backgroundColor:
                        activeColors[index % activeColors.length],
                    }}
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-[var(--card-foreground)]"
                    title={repo.name}
                  >
                    {repo.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--muted-foreground)]">
                    {repo.commits} · {repo.percentage}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
