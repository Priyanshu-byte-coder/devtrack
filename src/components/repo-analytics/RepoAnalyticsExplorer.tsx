"use client";
import { useCallback, useEffect, useState } from "react";
import RepoCarousel from "./RepoCarousel";
import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";
import { toast } from "sonner";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function RepoAnalyticsExplorer() {
  const [repos, setRepos] = useState<ExplorerRepoCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const fetchRepos = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/metrics/repo-explorer")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((json: { repos: ExplorerRepoCardData[] }) => setRepos(json.repos ?? []))
      .catch((err) => {
        console.error("Failed to fetch repo analytics:", err);
        setError("Could not load repo analytics right now.");
        toast.error("Failed to load repo analytics");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const filteredRepos = repos.filter((repo) =>
    repo.name?.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  return (
    <section className="mt-6 min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm md:p-6 fade-up transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--card-foreground)]">Repo Analytics</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Explore repository health, contributors, timeline, consistency and tech stack signals.</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--card-foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-3xl bg-[var(--card-muted)]/50 border border-[var(--border)]" />)}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--destructive-muted-border)] bg-[var(--destructive-muted)] p-5 text-sm text-[var(--destructive)] flex flex-col items-center justify-center text-center">
          <p className="font-medium mb-3">{error}</p>
          <button onClick={fetchRepos} className="rounded-xl border border-[var(--destructive-muted-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)] hover:text-white">Try again</button>
        </div>
      ) : (
        <RepoCarousel repos={filteredRepos} />
      )}
    </section>
  );
}
