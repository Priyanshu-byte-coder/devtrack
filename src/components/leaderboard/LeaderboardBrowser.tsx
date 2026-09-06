"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import EmptyState from "@/components/EmptyState";
import LeaderboardSkeleton from "@/app/leaderboard/LeaderboardSkeleton";
import SponsorBadge from "@/components/SponsorBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type LeaderboardEntry,
  type LeaderboardPayload,
  type LeaderboardTimeframe,
} from "@/lib/leaderboard";

const timeframeOptions: Array<{ value: LeaderboardTimeframe; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "all_time", label: "All-Time" },
];

const timeframeLabels: Record<LeaderboardTimeframe, string> = {
  weekly: "this week",
  monthly: "this month",
  all_time: "all time",
};

function getMetricValue(entry: LeaderboardEntry, tab: "streak" | "commits" | "prs"): number {
  if (tab === "streak") return entry.streak;
  if (tab === "commits") return entry.commits;
  return entry.prs;
}

function syncTimeframeToUrl(timeframe: LeaderboardTimeframe): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (timeframe === "weekly") {
    url.searchParams.delete("timeframe");
  } else {
    url.searchParams.set("timeframe", timeframe);
  }

  const nextUrl = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}${url.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

export default function LeaderboardBrowser({
  activeTab,
  language,
  initialLeaderboard,
  initialTimeframe,
}: {
  activeTab: "streak" | "commits" | "prs";
  language?: string;
  initialLeaderboard: LeaderboardPayload | null;
  initialTimeframe: LeaderboardTimeframe;
}) {
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>(initialTimeframe);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(initialLeaderboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setTimeframe(initialTimeframe);
    setLeaderboard(initialLeaderboard);
    setLoading(false);
    setError(null);
    requestIdRef.current += 1;
  }, [initialTimeframe, initialLeaderboard, language]);

  async function loadTimeframe(nextTimeframe: LeaderboardTimeframe, force = false) {
    if (!force && nextTimeframe === timeframe) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setTimeframe(nextTimeframe);
    setLoading(true);
    setError(null);
    syncTimeframeToUrl(nextTimeframe);

    try {
      const params = new URLSearchParams({ timeframe: nextTimeframe });
      if (language) {
        params.set("lang", language);
      }

      const response = await fetch(`/api/leaderboard?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as LeaderboardPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load leaderboard");
      }

      if (requestIdRef.current === requestId) {
        setLeaderboard(payload);
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setLeaderboard(null);
        setError("Leaderboard data is temporarily unavailable.");
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  const rows = leaderboard?.leaders[activeTab] ?? [];
  const hasFilters = Boolean(language) || timeframe !== "weekly";
  const metricLabel = activeTab === "streak" ? "days" : timeframeLabels[timeframe];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-2 shadow-[var(--shadow-soft)]">
        <Tabs
          defaultValue={initialTimeframe}
          value={timeframe}
          onValueChange={(value) => loadTimeframe(value as LeaderboardTimeframe)}
        >
          <TabsList
            className="!grid !grid-cols-3 !gap-1 !rounded-xl !border !border-[var(--border)] !bg-[var(--control)] !p-1"
            aria-label="Leaderboard timeframe"
          >
            {timeframeOptions.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="!rounded-lg !px-3 !py-2 !text-xs !font-semibold !text-[var(--muted-foreground)] !transition-all data-[state=active]:!bg-[var(--accent)] data-[state=active]:!text-[var(--accent-foreground)] data-[state=active]:!shadow-sm sm:!text-sm"
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error ? (
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
            <button
              type="button"
              onClick={() => loadTimeframe(timeframe, true)}
              className="secondary-button mt-4 inline-flex rounded-lg px-3 py-2 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </section>
      ) : loading ? (
        <LeaderboardSkeleton />
      ) : !leaderboard ? (
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Leaderboard data is temporarily unavailable.</p>
            <button
              type="button"
              onClick={() => loadTimeframe(timeframe, true)}
              className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Retry
            </button>
          </div>
        </section>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🏆"
          title={hasFilters ? "No leaderboard results for these filters" : "No public profiles yet"}
          description={
            hasFilters
              ? "Try a different timeframe or clear filters to view the full leaderboard."
              : "No public profiles yet - be the first to enable yours in Settings!"
          }
          actionLabel="Go to Settings"
          actionHref="/dashboard/settings"
        />
      ) : (
        <>
          <div className="mb-2 text-right text-sm text-[var(--muted-foreground)]">
            Updated {new Date(leaderboard.generatedAt).toLocaleString()}
          </div>

          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
            <div className="grid grid-cols-[72px_1fr_110px_110px] border-b border-[var(--border)] bg-[var(--control)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] md:grid-cols-[80px_1fr_140px_140px_120px]">
              <div>Rank</div>
              <div>Contributor</div>
              <div>{activeTab === "streak" ? "Streak" : activeTab === "commits" ? "Commits" : "PRs"}</div>
              <div className="hidden md:block">Score</div>
              <div>Profile</div>
            </div>

            {rows.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[72px_1fr_110px_110px] items-center border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[80px_1fr_140px_140px_120px]"
              >
                <div className="text-lg font-bold text-[var(--card-foreground)]">#{entry.rank}</div>
                <div className="flex min-w-0 items-center gap-3">
                  <Image
                    src={entry.avatarUrl}
                    alt={`${entry.username} avatar`}
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 rounded-full border border-[var(--border)]"
                  />
                  <div className="min-w-0">
                    <div
                      title={entry.username}
                      className="flex max-w-[120px] items-center gap-2 truncate font-semibold text-[var(--card-foreground)] sm:max-w-[180px] md:max-w-none"
                    >
                      @{entry.username} {entry.isSponsor && <SponsorBadge />}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {entry.commits} commits, {entry.prs} PRs, {entry.streak}d streak
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-[var(--card-foreground)]">
                    {getMetricValue(entry, activeTab)}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">{metricLabel}</div>
                </div>
                <div className="hidden text-sm font-medium text-[var(--card-foreground)] md:block">
                  {entry.score}
                </div>
                <div>
                  <Link href={entry.profileUrl} className="secondary-button inline-flex rounded-lg px-3 py-2 text-sm font-medium">
                    View
                  </Link>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
