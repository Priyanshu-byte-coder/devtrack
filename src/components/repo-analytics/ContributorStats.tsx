"use client";

import Image from "next/image";
import { RepoContributorData } from "@/lib/repo-analytics-types";

export default function ContributorStats({ contributors }: { contributors: RepoContributorData[] }) {
  const total = contributors.reduce((acc, c) => acc + c.contributions, 0);
  return (
    <div className="space-y-3">
      {contributors.map((contributor) => (
        <div key={contributor.login} className="flex items-center gap-3">
          <Image src={contributor.avatarUrl} alt={contributor.login} width={28} height={28} className="h-7 w-7 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
              <span className="truncate">{contributor.login}</span>
              <span>{contributor.contributions} commits</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full rounded-full" style={{ width: `${total > 0 ? (contributor.contributions / total) * 100 : 0}%`, backgroundColor: "var(--accent)" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
