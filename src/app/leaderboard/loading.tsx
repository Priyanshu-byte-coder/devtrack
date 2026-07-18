import Link from "next/link";
import React from "react";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              DevTrack
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-[var(--foreground)] md:text-4xl">Public Leaderboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)] md:text-base">
              Opted-in developers ranked by current streak, commits, and pull request activity.
            </p>
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-2 shadow-[var(--shadow-soft)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 rounded-lg bg-[var(--card-muted)] animate-pulse" />
          ))}
        </div>

        {/* Filters Skeleton */}
        <div className="mb-6 flex gap-3">
          <div className="h-10 w-32 rounded-lg bg-[var(--card-muted)] animate-pulse" />
          <div className="h-10 w-32 rounded-lg bg-[var(--card-muted)] animate-pulse" />
        </div>

        {/* Table Skeleton */}
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-[72px_1fr_110px_110px] border-b border-[var(--border)] bg-[var(--control)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] md:grid-cols-[80px_1fr_140px_140px_120px]">
            <div>Rank</div>
            <div>Contributor</div>
            <div>Metric</div>
            <div className="hidden md:block">Score</div>
            <div>Profile</div>
          </div>
          
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[72px_1fr_110px_110px] items-center border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[80px_1fr_140px_140px_120px]"
            >
              <div className="h-6 w-8 bg-[var(--card-muted)] rounded animate-pulse" />
              
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--card-muted)] animate-pulse shrink-0" />
                <div className="min-w-0 space-y-2">
                  <div className="h-4 w-24 sm:w-32 bg-[var(--card-muted)] rounded animate-pulse" />
                  <div className="h-3 w-32 sm:w-48 bg-[var(--card-muted)] rounded animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="h-5 w-12 bg-[var(--card-muted)] rounded animate-pulse" />
                <div className="h-3 w-16 bg-[var(--card-muted)] rounded animate-pulse" />
              </div>
              
              <div className="hidden md:block">
                <div className="h-5 w-16 bg-[var(--card-muted)] rounded animate-pulse" />
              </div>
              
              <div>
                <div className="h-9 w-16 bg-[var(--card-muted)] rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
