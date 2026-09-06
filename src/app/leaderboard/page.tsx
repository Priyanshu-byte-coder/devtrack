import Link from "next/link";
import { Suspense } from "react";
import LeaderboardFilters from "@/components/leaderboard/LeaderboardFilters";
import LeaderboardBrowser from "@/components/leaderboard/LeaderboardBrowser";
import {
  getLeaderboardData,
  filterLeaderboardByLanguage,
  normalizeLeaderboardTimeframe,
  type LeaderboardPayload,
  type LeaderboardTimeframe,
} from "@/lib/leaderboard";

type LeaderboardTab = "streak" | "commits" | "prs";

const tabs: Array<{ id: LeaderboardTab; label: string; metric: string }> = [
  { id: "streak", label: "Streak", metric: "days" },
  { id: "commits", label: "Commits", metric: "commits" },
  { id: "prs", label: "PRs", metric: "pull requests" },
];

function leaderboardHref(
  tab: LeaderboardTab,
  filters: { lang?: string; timeframe: LeaderboardTimeframe }
): string {
  const params = new URLSearchParams({ tab });

  if (filters.lang) {
    params.set("lang", filters.lang);
  }

  if (filters.timeframe !== "weekly") {
    params.set("timeframe", filters.timeframe);
  }

  return `/leaderboard?${params.toString()}`;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; lang?: string; timeframe?: string; period?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = tabs.some((tab) => tab.id === resolvedSearchParams.tab)
    ? (resolvedSearchParams.tab as LeaderboardTab)
    : "streak";
  const timeframe =
    normalizeLeaderboardTimeframe(resolvedSearchParams.timeframe) ??
    normalizeLeaderboardTimeframe(resolvedSearchParams.period) ??
    "weekly";
  const filters = { lang: resolvedSearchParams.lang, timeframe };

  let leaderboard: LeaderboardPayload | null = await getLeaderboardData(false, {
    timeframe,
  });

  if (leaderboard && resolvedSearchParams.lang) {
    leaderboard = await filterLeaderboardByLanguage(leaderboard, resolvedSearchParams.lang);
  }

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

        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-2 shadow-[var(--shadow-soft)]">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={leaderboardHref(tab.id, filters)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] hover:bg-[var(--control)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <Suspense fallback={null}>
          <LeaderboardFilters />
        </Suspense>

        <LeaderboardBrowser
          activeTab={activeTab}
          language={resolvedSearchParams.lang}
          initialLeaderboard={leaderboard}
          initialTimeframe={timeframe}
        />
      </div>
    </main>
  );
}