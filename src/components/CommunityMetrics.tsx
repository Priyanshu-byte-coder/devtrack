"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import { toast } from "sonner";

interface CommunityData {
  discussionsStarted: number;
  acceptedAnswers: number;
  commentsPosted: number;
}

export default function CommunityMetrics() {
  const { selectedAccount } = useAccount();
  const [metrics, setMetrics] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(() => {
    setLoading(true);
    setError(null);

    const url =
      selectedAccount !== null
        ? `/api/metrics/discussions?accountId=${encodeURIComponent(selectedAccount)}`
        : "/api/metrics/discussions";

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("API error");
        }
        return response.json();
      })
      .then((data: CommunityData) => setMetrics(data))
      .catch((err) => {
        console.error("Failed to fetch community metrics:", err);
        setError(
          "We couldn't load your discussion analytics right now. Please try again in a moment."
        );
        toast.error("Failed to load community metrics");
      })
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const stats = metrics
    ? [
        { label: "Discussions Started (30d)", value: metrics.discussionsStarted },
        { label: "Accepted Answers", value: metrics.acceptedAnswers },
        { label: "Discussion Comments", value: metrics.commentsPosted },
      ]
    : [];

  const isEmpty =
    metrics != null &&
    metrics.discussionsStarted === 0 &&
    metrics.acceptedAnswers === 0 &&
    metrics.commentsPosted === 0;

  return (
    <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Community Discussions
          </h2>
          <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            GitHub Discussions activity across the selected account
          </p>
        </div>
        <button
          type="button"
          onClick={fetchMetrics}
          disabled={loading}
          aria-label="Refresh discussion analytics"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--control)] sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90 active:scale-95"
        >
          {loading ? (
            <svg aria-hidden="true" className="animate-spin h-3 w-3 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : null}
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="space-y-4"
        >
          <span className="sr-only">Loading discussion analytics</span>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="min-h-20 rounded-lg skeleton-shimmer"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchMetrics}
            className="mt-3 rounded-md border border-[var(--border)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)]/90 transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      ) : metrics ? (
        <div className="space-y-4">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-[var(--control)] p-4 text-center min-w-0 sm:min-h-24 stat-cell animate-fade-in-up"
              >
                <div className="text-[clamp(1.5rem,5vw,1.75rem)] font-bold leading-none text-[var(--accent)]">
                  {stat.value}
                </div>
                <div className="mt-2 text-[clamp(0.75rem,2.4vw,0.875rem)] leading-snug text-[var(--muted-foreground)] break-words hyphens-auto">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {isEmpty && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--control)]/60 p-4 text-sm text-[var(--muted-foreground)] transition-colors duration-200 hover:bg-[var(--card-muted)]">
              No discussion activity yet in this 30-day window.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
