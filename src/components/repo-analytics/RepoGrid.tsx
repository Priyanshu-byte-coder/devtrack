"use client";

import { useMemo, useState } from "react";
import RepoCard from "./RepoCard";
import RepoAnalyticsSheet from "./RepoAnalyticsSheet";
import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";

export default function RepoGrid({ repos }: { repos: ExplorerRepoCardData[] }) {
  const PAGE_SIZE = 3;
  const [query, setQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"activity" | "updated">("activity");
  const [selectedRepo, setSelectedRepo] = useState<ExplorerRepoCardData | null>(null);
  const [page, setPage] = useState(1);

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
    <div className="space-y-5">
      <div className="flex flex-col gap-1 md:flex-row md:items-center">
        <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search repositories..." className="w-full rounded-xl border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--card-foreground)] md:max-w-xs" />
        <div className="flex flex-1 flex-wrap gap-2">
          <select value={languageFilter} onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }} className="rounded-xl border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--card-foreground)]">
            {languages.map((language) => <option key={language} value={language}>{language === "all" ? "All languages" : language}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as "activity" | "updated"); setPage(1); }} className="rounded-xl border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--card-foreground)]">
            <option value="activity">Sort by activity</option>
            <option value="updated">Sort by updated</option>
          </select>
        </div>
      </div>

      {filteredRepos.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-6 text-center text-sm text-[var(--muted-foreground)]">No repositories found for this filter.</div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pageRepos.map((repo) => <RepoCard key={repo.id} repo={repo} onViewAnalytics={setSelectedRepo} />)}
        </div>
      )}

      {filteredRepos.length > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card-muted)] px-3 py-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            Showing {Math.min((safePage - 1) * PAGE_SIZE + 1, filteredRepos.length)}-
            {Math.min(safePage * PAGE_SIZE, filteredRepos.length)} of {filteredRepos.length}
          </p>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-1.5 text-xs text-[var(--card-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-[var(--muted-foreground)]">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-1.5 text-xs text-[var(--card-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
          </div>
        </div>
      )}

      <RepoAnalyticsSheet repoFullName={selectedRepo?.fullName ?? null} open={Boolean(selectedRepo)} onClose={() => setSelectedRepo(null)} />
    </div>
  );
}
