"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";
import {
  formatRelativeDate,
  formatDate,
} from "@/lib/date-utils";
import { Button, buttonVariants } from "@/components/ui/button";

interface RepoCardProps {
  repo: ExplorerRepoCardData;
  onViewAnalytics: (repo: ExplorerRepoCardData) => void;
}

export default function RepoCard({
  repo,
  onViewAnalytics,
}: RepoCardProps) {
  const activityData = Array.isArray(repo.activity7d) ? repo.activity7d : [];
  const activeDays = activityData.filter((day) => day.commits > 0).length;
  const consistency = activityData.length
    ? Math.round((activeDays / 7) * 100)
    : 0;

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm backdrop-blur-xl animate-slide-up transition-all duration-300 hover:shadow-md hover:-translate-y-1"
    >
      {/* Border Glow */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-[var(--border)]" />

      <div className="relative flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight text-[var(--card-foreground)]">
              {repo.name}
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--control)] px-2.5 py-1">
                {repo.commitCount} commits
              </span>

              <span className="rounded-full border border-[var(--border)] bg-[var(--control)] px-2.5 py-1">
                Created {formatDate(repo.createdAt)}
              </span>
            </div>
          </div>

          {/* Consistency */}
          <div className="flex flex-col items-end">
            <span className="text-lg font-semibold text-[var(--card-foreground)]">
              {consistency}%
            </span>

            <span className="text-[11px] text-[var(--muted-foreground)]">
              Consistency
            </span>
          </div>
        </div>

        {/* Activity Graph */}
        <div className="h-32 w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData}>
              <defs>
                <linearGradient
                  id={`repoActivity-${repo.name}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              />

              <Tooltip
                cursor={false}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  color: "var(--card-foreground)",
                }}
              />

              <Area
                type="monotone"
                dataKey="commits"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill={`url(#repoActivity-${repo.name})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>
            Updated {formatRelativeDate(repo.updatedAt)}
          </span>

          <span>
            {repo.primaryLanguage ?? "Unknown"}
          </span>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Repo
          </a>

          <Button
            variant="outline"
            onClick={() => onViewAnalytics(repo)}
          >
            View
          </Button>
        </div>
      </div>
    </article>
  );
}
