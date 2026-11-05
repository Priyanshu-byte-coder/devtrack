"use client";

import Image from "next/image";
import { RepoContributorData } from "@/lib/repo-analytics-types";

export default function ContributorStats({
  contributors,
}: {
  contributors: RepoContributorData[];
}) {
  if (contributors.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No contributor data yet.
      </p>
    );
  }
  const top = Math.max(1, ...contributors.map((c) => c.contributions));
  return (
    <ul className="space-y-2.5">
      {contributors.map((contributor) => (
        <li key={contributor.login} className="flex items-center gap-3">
          <Image
            src={contributor.avatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 border-2 border-[var(--border)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-3 text-xs">
              <a
                href={`https://github.com/${encodeURIComponent(contributor.login)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[var(--card-foreground)] hover:text-[var(--accent)]"
              >
                {contributor.login}
              </a>
              <span className="shrink-0 text-[var(--muted-foreground)]">
                {contributor.contributions.toLocaleString()} commits
              </span>
            </div>
            <div className="mt-1 h-2 bg-[var(--card)]">
              <div
                className="h-full bg-[var(--accent)]"
                style={{ width: `${(contributor.contributions / top) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
