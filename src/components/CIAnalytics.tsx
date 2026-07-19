"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";

interface CIAnalyticsData {
  successRate: number;
  averageDurationMinutes: number;
  flakiestWorkflow: string | null;
  totalRuns: number;
  reposChecked: number;
}

export default function CIAnalytics() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<CIAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitResetTime, setRateLimitResetTime] = useState<Date | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    if (!rateLimitResetTime) return;
    const msUntilReset = rateLimitResetTime.getTime() - Date.now();
    if (msUntilReset <= 0) {
      setIsRateLimited(false);
      setRateLimitResetTime(null);
      return;
    }
    const timer = setTimeout(() => {
      setIsRateLimited(false);
      setRateLimitResetTime(null);
      setError(null);
    }, msUntilReset);
    return () => clearTimeout(timer);
  }, [rateLimitResetTime]);

  const fetchCIAnalytics = useCallback(() => {
    if (isRateLimited) return;
    setLoading(true);
    setError(null);

    const accountParam =
      selectedAccount !== null
        ? `?accountId=${encodeURIComponent(selectedAccount)}`
        : "";

    fetch(`/api/metrics/ci${accountParam}`)
      .then((res) => {
        if (res.status === 403) {
          const resetHeader = res.headers.get("X-RateLimit-Reset");
          if (resetHeader) {
            const resetDate = new Date(parseInt(resetHeader, 10) * 1000);
            const resetTimeStr = resetDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            setRateLimitResetTime(resetDate);
            setIsRateLimited(true);
            throw new Error(
              `GitHub API rate limit reached. Resets at ${resetTimeStr}. Try again later.`
            );
          }
          throw new Error("GitHub API rate limit reached. Please try again later.");
        }
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((payload: CIAnalyticsData) => {
        setData(payload);
        setIsRateLimited(false);
        setRateLimitResetTime(null);
      })
      .catch((err: Error) => {
        setError(
          err.message.includes("rate limit")
            ? err.message
            : "CI data unavailable - ensure Actions are enabled on your repos"
        );
      })
      .finally(() => setLoading(false));
  }, [selectedAccount, isRateLimited]);

  useEffect(() => {
    fetchCIAnalytics();
  }, [fetchCIAnalytics]);

  const stats = data
    ? [
        { label: "Success Rate", value: `${data.successRate}%` },
        { label: "Avg Duration", value: `${data.averageDurationMinutes}m` },
        { label: "Runs (30d)", value: data.totalRuns },
        { label: "Repos Checked", value: data.reposChecked },
      ]
    : [];

  const refreshLabel = isRateLimited
    ? rateLimitResetTime
      ? `Retry at ${rateLimitResetTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Rate limited"
    : "Refresh";

  const hasNoCIData = !!data && data.totalRuns === 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            CI Analytics
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            GitHub Actions health across your top repositories
          </p>
        </div>
        <button
          type="button"
          onClick={fetchCIAnalytics}
          disabled={isRateLimited || loading}
          title={isRateLimited ? "GitHub API rate limit reached" : "Refresh CI data"}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--control)] disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90 active:scale-95"
        >
          {loading ? (
            <svg className="animate-spin h-3 w-3 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : null}
          <span>{refreshLabel}</span>
        </button>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <span className="sr-only">Loading CI analytics</span>
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              aria-hidden="true"
              className="h-20 rounded-lg skeleton-shimmer"
            />
          ))}
        </div>
      ) : error ? (
        <div
          className={`rounded-lg border p-4 text-sm ${
            isRateLimited
              ? "border-[var(--border)] bg-[var(--control)] text-[var(--warning)]"
              : "border-[var(--destructive)]/20 bg-[var(--destructive)]/10 text-[var(--destructive)]"
          }`}
        >
          <p>{error}</p>
          {!isRateLimited && (
            <button
              type="button"
              onClick={fetchCIAnalytics}
              className="mt-3 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
            >
              Try again
            </button>
          )}
        </div>
      ) : hasNoCIData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 text-4xl">⚙️</div>
      
          <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
            No CI runs detected
          </h3>
      
          <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
            Set up GitHub Actions to see workflow and build analytics here.
          </p>
      
          <a
            href="https://docs.github.com/actions"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--control)]"
          >
            Learn GitHub Actions
          </a>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-[var(--control)] p-4 text-center stat-cell animate-fade-in-up"
              >
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
      
          <div className="rounded-lg bg-[var(--control)] p-4 stat-cell">
            <p className="text-sm font-medium text-[var(--card-foreground)]">
              Flakiest workflow
            </p>
            <p
              className="mt-1 truncate text-sm text-[var(--muted-foreground)]"
              title={data.flakiestWorkflow ?? undefined}
            >
              {data.flakiestWorkflow ?? "No failing workflows in this window"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
