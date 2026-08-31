"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import type { CommitItem } from "@/lib/github";

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 300;

interface CommitSearchPanelProps {
  commits: CommitItem[];
  loading: boolean;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const matchRegex = new RegExp(`^${escaped}$`, "i");

  return (
    <>
      {parts.map((part, i) =>
        matchRegex.test(part) ? (
          <mark
            key={i}
            className="bg-[var(--accent-soft)] text-[var(--foreground)] rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function CommitSearchPanel({ commits, loading }: CommitSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isOpen, setIsOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-expand when user starts typing
  useEffect(() => {
    if (searchQuery.length > 0 && !isOpen) {
      setIsOpen(true);
    }
  }, [searchQuery, isOpen]);

  // Reset visible count when query changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedQuery]);

  const filteredCommits = useMemo(() => {
    if (!debouncedQuery) return commits;
    const q = debouncedQuery.toLowerCase();
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) || c.repo.toLowerCase().includes(q)
    );
  }, [commits, debouncedQuery]);

  const visibleCommits = useMemo(
    () => filteredCommits.slice(0, visibleCount),
    [filteredCommits, visibleCount]
  );

  const hasMore = visibleCount < filteredCommits.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  const handleClear = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <div className="h-10 rounded-lg bg-[var(--background)] animate-pulse" />
      </div>
    );
  }

  if (commits.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      {/* Search input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1" role="search">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commits..."
            aria-label="Search commits by message or repository"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-10 pr-10 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus:border-transparent transition-colors"
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={handleToggle}
          aria-label={isOpen ? "Collapse commit list" : "Expand commit list"}
          aria-expanded={isOpen}
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--control-hover)] transition-all hover:opacity-90 active:scale-95"
        >
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
          {commits.length} commit{commits.length !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Results */}
      {isOpen && (
        <div className="mt-3">
          {/* Result count */}
          <p aria-live="polite" className="mb-2 text-xs text-[var(--muted-foreground)]">
            {debouncedQuery ? (
              <>
                Showing {Math.min(visibleCount, filteredCommits.length)} of{" "}
                {filteredCommits.length} commit{filteredCommits.length !== 1 ? "s" : ""}{" "}
                matching &ldquo;{debouncedQuery}&rdquo;
              </>
            ) : (
              <>
                Showing {Math.min(visibleCount, commits.length)} of {commits.length} commit
                {commits.length !== 1 ? "s" : ""}
              </>
            )}
          </p>

          {filteredCommits.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
              No commits matching &ldquo;{debouncedQuery}&rdquo;
            </p>
          ) : (
            <>
              <ul className="max-h-96 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {visibleCommits.map((commit) => (
                  <li key={commit.sha}>
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[var(--accent-soft)] transition-colors group"
                    >
                      {/* Date */}
                      <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)] pt-0.5 min-w-[4.5rem]">
                        {commit.date}
                      </span>

                      {/* Repo badge */}
                      <span className="shrink-0 rounded-md bg-[var(--control)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)] max-w-[6rem] sm:max-w-[12rem] truncate">
                        <HighlightMatch text={commit.repo} query={debouncedQuery} />
                      </span>

                      {/* Message */}
                      <span className="min-w-0 flex-1 text-[var(--foreground)] truncate group-hover:text-[var(--accent)] transition-colors">
                        <HighlightMatch text={commit.message} query={debouncedQuery} />
                      </span>

                      {/* External link icon */}
                      <svg
                        className="shrink-0 h-4 w-4 text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity pt-0.5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                        />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>

              {/* Load more */}
              {hasMore && (
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--control-hover)] transition-all hover:opacity-90 active:scale-95"
                  >
                    Load more ({filteredCommits.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
