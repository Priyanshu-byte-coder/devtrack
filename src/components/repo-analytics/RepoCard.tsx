"use client";

import type { CSSProperties } from "react";
import { BarChart3, ExternalLink } from "lucide-react";
import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";
import { formatRelativeDate } from "@/lib/date-utils";
import { safeExternalHref } from "@/lib/safe-url";
import { languageColor } from "@/lib/language-colors";
import { hudLabelClass } from "@/components/ui/arcade";

interface RepoCardProps {
  repo: ExplorerRepoCardData;
  onViewAnalytics: (repo: ExplorerRepoCardData) => void;
}

export default function RepoCard({ repo, onViewAnalytics }: RepoCardProps) {
  const activity = Array.isArray(repo.activity7d) ? repo.activity7d : [];
  const activeDays = activity.filter((day) => day.commits > 0).length;
  const peak = Math.max(1, ...activity.map((d) => d.commits));
  const color = languageColor(repo.primaryLanguage);

  return (
    <article
      className="stat-cell flex h-full flex-col gap-4 p-4"
      style={{ "--stat-c": color } as CSSProperties}
    >
      <div className="min-w-0">
        <h3
          className="truncate text-base font-semibold text-[var(--card-foreground)]"
          title={repo.fullName}
        >
          {repo.name}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5" style={{ background: color }} />
            {repo.primaryLanguage ?? "No language"}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            Updated {formatRelativeDate(repo.updatedAt)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--card)] px-3 py-2">
          <div className={hudLabelClass}>30-day commits</div>
          <div className="stat-value mt-1 text-lg">{repo.commitCount}</div>
        </div>
        <div className="bg-[var(--card)] px-3 py-2">
          <div className={hudLabelClass}>Active this week</div>
          <div className="stat-value mt-1 text-lg">{activeDays}/7</div>
        </div>
      </div>

      <div>
        <div
          className="flex h-14 items-end gap-1"
          role="img"
          aria-label={`Commits in the last 7 days: ${activity
            .map((d) => `${d.day} ${d.commits}`)
            .join(", ")}`}
        >
          {activity.map((d, i) => (
            <div
              key={`${d.day}-${i}`}
              className="flex-1"
              title={`${d.day}: ${d.commits} commit${d.commits === 1 ? "" : "s"}`}
              style={{
                height: `${d.commits > 0 ? Math.max(14, (d.commits / peak) * 100) : 6}%`,
                background:
                  d.commits > 0
                    ? color
                    : "color-mix(in srgb, var(--border) 70%, transparent)",
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {activity.map((d, i) => (
            <span
              key={`${d.day}-label-${i}`}
              className="flex-1 text-center text-[10px] text-[var(--muted-foreground)]"
            >
              {d.day.slice(0, 1)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={() => onViewAnalytics(repo)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 bg-[var(--accent)] px-3 py-2 font-pixel text-[11px] uppercase tracking-[0.08em] text-[var(--accent-foreground)] hover:opacity-90"
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          Analytics
        </button>
        <a
          href={safeExternalHref(repo.htmlUrl)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${repo.fullName} on GitHub`}
          className="inline-flex items-center justify-center border-2 border-[var(--border)] px-3 py-2 text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
