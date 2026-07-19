"use client";

import { useMemo, useState } from "react";
import RepoCard from "./RepoCard";
import RepoAnalyticsSheet from "./RepoAnalyticsSheet";
import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";

export default function RepoCarousel({ repos }: { repos: ExplorerRepoCardData[] }) {
  const PAGE_SIZE = 3;
  const [page, setPage] = useState(1);
  const [selectedRepo, setSelectedRepo] = useState<ExplorerRepoCardData | null>(null);

  const [query, setQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"activity" | "updated">("activity");

  const hasActiveFilters =
    query !== "" ||
    languageFilter !== "all" ||
    sortBy !== "activity";

  const resetFilters = () => {
    setQuery("");
    setLanguageFilter("all");
    setSortBy("activity");
    setPage(1);
  };

  const languages = useMemo(() => ["all", ...Array.from(new Set(repos.map((r) => r.primaryLanguage).filter(Boolean) as string[]))], [repos]);

  const filteredRepos = useMemo(() => {
    return repos
      .filter((repo) => repo.name.toLowerCase().includes(query.toLowerCase()) || repo.fullName.toLowerCase().includes(query.toLowerCase()))
      .filter((repo) => languageFilter === "all" || repo.primaryLanguage === languageFilter)
      .sort((a, b) => sortBy === "activity" ? b.commitCount - a.commitCount : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [repos, query, languageFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRepos = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRepos.slice(start, start + PAGE_SIZE);
  }, [filteredRepos, safePage]);

  return (
    <div className="space-y-6">
      {/* Modern Top Navigation Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center justify-between rounded-2xl bg-[var(--card-muted)]/30 p-3 border border-[var(--border)]">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search repos..."
            className="w-full sm:w-auto rounded-xl border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] transition-all flex-1 min-w-[200px]" />
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={languageFilter}
              onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus:border-[var(--accent)] transition-all cursor-pointer flex-1"
            >
              {languages.map((language) => <option key={language} value={language}>{language === "all" ? "All Languages" : language}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as "activity" | "updated"); setPage(1); }}
              className="rounded-xl border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus:border-[var(--accent)] transition-all cursor-pointer flex-1"
            >
              <option value="activity">Most Active</option>
              <option value="updated">Recently Updated</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:border-[var(--accent)] transition-all"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Pagination Arrows */}
        {filteredRepos.length > PAGE_SIZE && (
          <div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto">
            <span className="text-sm font-medium text-[var(--muted-foreground)] ml-1 lg:ml-0">
              <span className="text-[var(--card-foreground)]">{safePage}</span> / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                aria-label="Previous page"
                className="group flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] disabled:opacity-40 disabled:hover:bg-[var(--card)] disabled:hover:text-inherit disabled:hover:border-[var(--border)] transition-all duration-300 shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-0.5">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                aria-label="Next page"
                className="group flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] disabled:opacity-40 disabled:hover:bg-[var(--card)] disabled:hover:text-inherit disabled:hover:border-[var(--border)] transition-all duration-300 shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cards View */}
      {filteredRepos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card-muted)]/20 p-16 text-center fade-up mt-4">
          <div className="rounded-full bg-[var(--card)] p-4 shadow-sm mb-4 border border-[var(--border)] transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-foreground)]">
              <path d="M21 12c0 1.2-4 6-9 6s-9-4.8-9-6c0-1.2 4-6 9-6s9 4.8 9 6Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--card-foreground)]">No repositories found</h3>
          <p className="mt-2 text-sm text-[var(--muted-foreground)] max-w-sm">Try adjusting your filters or search query to find what you&apos;re looking for.</p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 relative mt-6">
          {pageRepos.map((repo, idx) => (
            <div
              key={`${repo.id}-${safePage}`}
              className="fade-up transition-all duration-500 hover:-translate-y-1.5"
              style={{ animationDelay: `${idx * 75}ms` }}
            >
              <RepoCard repo={repo} onViewAnalytics={setSelectedRepo} />
            </div>
          ))}
        </div>
      )}

      <RepoAnalyticsSheet repoFullName={selectedRepo?.fullName ?? null} open={Boolean(selectedRepo)} onClose={() => setSelectedRepo(null)} />
    </div>
  );
}
