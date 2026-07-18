"use client";

import { useCallback, useEffect, useState, memo, useMemo } from "react";
import { Star, GitFork } from "lucide-react";
import WidgetSkeleton, { SkeletonBlock } from "./WidgetSkeleton";

interface PinnedRepo {
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string; color: string } | null;
}

// Memoized RepoCard component with strict equality checking
const RepoCard = memo(({ repo }: { repo: PinnedRepo }) => {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-muted)] p-4 transition-colors hover:border-[var(--accent)]"
    >
      <span className="truncate text-sm font-semibold text-[var(--card-foreground)]">
        {repo.name}
      </span>

      <span className="line-clamp-2 flex-1 text-xs text-[var(--muted-foreground)]">
        {repo.description ?? "No description"}
      </span>

      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
        {repo.primaryLanguage && (
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  repo.primaryLanguage.color ?? "#8b949e",
              }}
            />
            {repo.primaryLanguage?.name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Star size={14} className="fill-yellow-400 text-yellow-400" aria-hidden="true" />
          {repo.stargazerCount}
        </span>
        <span className="flex items-center gap-1">
          <GitFork size={14} aria-hidden="true" />
          {repo.forkCount}
        </span>
      </div>
    </a>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.repo.name === nextProps.repo.name &&
    prevProps.repo.description === nextProps.repo.description &&
    prevProps.repo.url === nextProps.repo.url &&
    prevProps.repo.stargazerCount === nextProps.repo.stargazerCount &&
    prevProps.repo.forkCount === nextProps.repo.forkCount &&
    prevProps.repo.primaryLanguage?.name === nextProps.repo.primaryLanguage?.name &&
    prevProps.repo.primaryLanguage?.color === nextProps.repo.primaryLanguage?.color
  );
});
RepoCard.displayName = "RepoCard";

export default function PinnedRepos() {
  const [pinnedRepos, setPinnedRepos] = useState<PinnedRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPinnedRepos = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch("/api/metrics/pinned-repos")
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((data: { pinnedRepos?: PinnedRepo[] }) =>
        setPinnedRepos(data.pinnedRepos ?? [])
      )
      .catch(() =>
        setError("We couldn't load your pinned repositories right now. Please try again in a moment.")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPinnedRepos();
  }, [fetchPinnedRepos]);

  // Caching the sorting of pinned repos to prevent thrashing
  const sortedPinnedRepos = useMemo(() => {
    return [...pinnedRepos].sort((a, b) => b.stargazerCount - a.stargazerCount);
  }, [pinnedRepos]);

  if (loading) {
    return (
      <WidgetSkeleton title="Pinned Repositories" className="transition-all duration-300">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonBlock key={i} className="h-24" />
          ))}
        </div>
      </WidgetSkeleton>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        Pinned Repositories
      </h2>
      {error ? (
        <div className="rounded-lg border border-[var(--destructive-muted-border)] bg-[var(--destructive-muted)] p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchPinnedRepos}
            className="mt-3 rounded-md border border-[var(--destructive-muted-border)] px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive-muted)]"
          >
            Try again
          </button>
        </div>
      ) : sortedPinnedRepos.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No pinned repositories.{" "}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--accent)]"
          >
            Pin some on GitHub
          </a>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedPinnedRepos.map((repo) => (
            <RepoCard key={repo.url} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}
