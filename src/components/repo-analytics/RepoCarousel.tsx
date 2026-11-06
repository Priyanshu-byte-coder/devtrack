"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import RepoCard from "./RepoCard";
import RepoAnalyticsSheet from "./RepoAnalyticsSheet";
import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";
import { arcadeTabClass, arcadeTabGroupClass } from "@/components/ui/arcade";

const PAGE_SIZE = 6;

const controlClass =
  "border-2 border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--card-foreground)] focus-visible:border-[var(--accent)] focus-visible:outline-none";

export default function RepoCarousel({
  repos,
}: {
  repos: ExplorerRepoCardData[];
}) {
  const [page, setPage] = useState(1);
  const [selectedRepo, setSelectedRepo] = useState<ExplorerRepoCardData | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"activity" | "updated">("activity");

  const languages = useMemo(
    () =>
      Array.from(
        new Set(repos.map((r) => r.primaryLanguage).filter(Boolean) as string[])
      ).sort(),
    [repos]
  );

  const filteredRepos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos
      .filter((repo) => !q || repo.fullName.toLowerCase().includes(q))
      .filter(
        (repo) =>
          languageFilter === "all" || repo.primaryLanguage === languageFilter
      )
      .sort((a, b) =>
        sortBy === "activity"
          ? b.commitCount - a.commitCount
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [repos, query, languageFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredRepos.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRepos = filteredRepos.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const activeRepos = repos.filter((r) =>
    (r.activity7d ?? []).some((d) => d.commits > 0)
  ).length;
  const monthCommits = repos.reduce((sum, r) => sum + r.commitCount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["Repositories", repos.length, "#6ba8ff"],
          ["Active this week", activeRepos, "#34d399"],
          ["Commits, 30 days", monthCommits, "#c77dff"],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            className="stat-cell p-3"
            style={{ "--stat-c": color } as CSSProperties}
          >
            <div className="font-pixel text-[9px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] sm:text-[10px]">
              {label}
            </div>
            <div className="stat-value mt-1 text-lg sm:text-xl">
              {Number(value).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search repositories</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search repositories"
            className={`${controlClass} w-full pl-9`}
          />
        </label>
        <div className="flex items-center gap-2">
          <label className="min-w-0 flex-1 lg:flex-none">
            <span className="sr-only">Language</span>
            <select
              value={languageFilter}
              onChange={(e) => {
                setLanguageFilter(e.target.value);
                setPage(1);
              }}
              className={`${controlClass} w-full cursor-pointer`}
            >
              <option value="all">All languages</option>
              {languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </label>
          <div
            className={arcadeTabGroupClass}
            role="group"
            aria-label="Sort by"
          >
            {(
              [
                ["activity", "Active"],
                ["updated", "Recent"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSortBy(value);
                  setPage(1);
                }}
                aria-pressed={sortBy === value}
                className={arcadeTabClass(sortBy === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredRepos.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--border)] p-10 text-center">
          <p className="font-pixel text-xs uppercase tracking-[0.12em] text-[var(--card-foreground)]">
            No repositories found
          </p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Try another search or language.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageRepos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              onViewAnalytics={setSelectedRepo}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-3"
          aria-label="Repository pages"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="border-2 border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="font-pixel text-[11px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            aria-label="Next page"
            className="border-2 border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}

      <RepoAnalyticsSheet
        repoFullName={selectedRepo?.fullName ?? null}
        open={Boolean(selectedRepo)}
        onClose={() => setSelectedRepo(null)}
      />
    </div>
  );
}
