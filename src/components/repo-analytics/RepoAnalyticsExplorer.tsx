"use client";
import { useCallback, useEffect, useState } from "react";
import RepoCarousel from "./RepoCarousel";
import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";
import { SkeletonBlock } from "@/components/WidgetSkeleton";

export default function RepoAnalyticsExplorer() {
  const [repos, setRepos] = useState<ExplorerRepoCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/metrics/repo-explorer")
      .then((res) => {
        if (res.status === 429)
          throw new Error(
            "GitHub is rate limiting your account right now. Try again in a few minutes."
          );
        if (!res.ok)
          throw new Error("Could not load your repositories right now.");
        return res.json();
      })
      .then((json: { repos?: ExplorerRepoCardData[] }) =>
        setRepos(json.repos ?? [])
      )
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  return (
    <section className="px-frame min-w-0 bg-[var(--card)] p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
          Repo analytics
        </h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Your repositories by recent activity. Open one for contributors,
          timeline, health and languages.
        </p>
      </div>

      {loading ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading repositories</span>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-[72px]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-64" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="border-2 border-red-500/40 p-4 text-sm">
          <p className="text-[var(--card-foreground)]">{error}</p>
          <button type="button" onClick={fetchRepos} className="px-btn mt-3">
            Try again
          </button>
        </div>
      ) : (
        <RepoCarousel repos={repos} />
      )}
    </section>
  );
}
