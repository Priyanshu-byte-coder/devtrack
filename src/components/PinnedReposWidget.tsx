"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, GitFork, ExternalLink, RefreshCw } from "lucide-react";
import type { PinnedRepoDetails } from "@/lib/pinned-repos";

interface PinnedReposWidgetProps {
  initialRepos?: PinnedRepoDetails[];
  isPublic?: boolean;
}

export default function PinnedReposWidget({
  initialRepos,
  isPublic = false,
}: PinnedReposWidgetProps) {
  const [repos, setRepos] = useState<PinnedRepoDetails[]>(initialRepos ?? []);
  const [loading, setLoading] = useState(!initialRepos);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (isPublic) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/pinned-repos/details");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRepos(data.pinnedRepos ?? []);
    } catch (err) {
      console.error(err);
      setError("Failed to load pinned spotlight repositories.");
    } finally {
      setLoading(false);
    }
  }, [isPublic]);

  useEffect(() => {
    if (!initialRepos) {
      fetchDetails();
    } else {
      setRepos(initialRepos);
    }
  }, [initialRepos, fetchDetails]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
          Repository Spotlight 🚀
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-muted)] p-5"
            >
              <div className="h-5 w-3/4 bg-[var(--border)] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-[var(--border)] rounded animate-pulse" />
              <div className="h-8 w-full bg-[var(--border)] rounded animate-pulse mt-2" />
              <div className="border-t border-[var(--border)]/60 pt-3 mt-1 flex justify-between">
                <div className="h-8 w-1/3 bg-[var(--border)] rounded animate-pulse" />
                <div className="h-8 w-1/3 bg-[var(--border)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
          Repository Spotlight 🚀
        </h2>
        <div className="rounded-xl border border-[var(--destructive-muted-border)] bg-[var(--destructive-muted)] p-4 text-sm text-[var(--destructive)] flex items-center justify-between">
          <p>{error}</p>
          {!isPublic && (
            <button
              onClick={fetchDetails}
              className="flex items-center gap-1 text-xs font-semibold underline hover:no-underline"
            >
              <RefreshCw size={12} /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (repos.length === 0) {
    if (isPublic) return null; // Hide completely on public profile if empty

    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
          Repository Spotlight 🚀
        </h2>
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-muted)]/50 p-8 text-center">
          <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-1">
            Showcase your best projects!
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto mb-4">
            Pin up to 3 of your flagship repositories in Settings to spotlight them here and on your public profile.
          </p>
          <a
            href="/dashboard/settings"
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)] flex items-center justify-between">
        <span>Repository Spotlight 🚀</span>
        {!isPublic && (
          <a
            href="/dashboard/settings"
            className="text-xs font-normal text-[var(--accent)] hover:underline"
          >
            Manage Pins
          </a>
        )}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => {
          const shortName = repo.name.split("/")[1] ?? repo.name;
          const owner = repo.name.split("/")[0] ?? "";

          // Generate Area Sparkline points
          const sparkline = repo.sparkline || Array(30).fill(0);
          const width = 140;
          const height = 34;
          const maxVal = Math.max(...sparkline, 1);

          const points = sparkline.map((val, idx) => {
            const x = (idx / (sparkline.length - 1)) * width;
            const y = height - 2 - ((val / maxVal) * (height - 4));
            return { x, y };
          });

          const pathPoints = points.map(p => `${p.x},${p.y}`).join(" ");
          const lineData = `M ${points.map(p => `${p.x} ${p.y}`).join(" L ")}`;
          const fillData = `${lineData} L ${width} ${height} L 0 ${height} Z`;

          return (
            <div
              key={repo.name}
              className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-muted)] p-5 transition-all duration-300 hover:shadow-[var(--shadow-soft)] hover:border-[var(--accent)]/50 group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-semibold text-[var(--card-foreground)] hover:text-[var(--accent)] transition-colors"
                  >
                    <span className="truncate">{shortName}</span>
                    <ExternalLink size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <span className="text-[10px] text-[var(--muted-foreground)] block truncate">
                    by {owner}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 min-h-[32px] leading-relaxed">
                {repo.description ?? "No description provided."}
              </p>

              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in GitHub"
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
              >
                <ExternalLink size={12} />
                Open in GitHub
              </a>

              {/* Sparkline Graph */}
              <div className="flex items-center justify-between border-t border-[var(--border)]/60 pt-3 mt-1">
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider block">
                    30d Activity
                  </span>
                  <span className="text-xs font-semibold text-[var(--card-foreground)]">
                    {sparkline.reduce((a, b) => a + b, 0)} commit(s)
                  </span>
                </div>
                <div className="w-[140px] h-[34px] relative" title="Commit activity sparkline (last 30 days)">
                  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                    <defs>
                      <linearGradient id={`sparkGrad-${repo.name.replace(/\//g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <path
                      d={fillData}
                      fill={`url(#sparkGrad-${repo.name.replace(/\//g, "-")})`}
                    />
                    <path
                      d={lineData}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] border-t border-[var(--border)]/60 pt-3 mt-auto">
                <div className="flex items-center gap-2">
                  {repo.primaryLanguage && (
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: repo.primaryLanguage.color }}
                      />
                      {repo.primaryLanguage.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    {repo.stargazerCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork size={12} />
                    {repo.forkCount}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
