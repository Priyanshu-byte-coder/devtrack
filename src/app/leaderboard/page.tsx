import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import EmptyState from "@/components/EmptyState";
import LeaderboardFilters from "@/components/leaderboard/LeaderboardFilters";
import LeaderboardSkeleton from "@/app/leaderboard/LeaderboardSkeleton";
import SponsorBadge from "@/components/SponsorBadge";
import { getLeaderboardData, filterLeaderboardByLanguage, type LeaderboardPayload } from "@/lib/leaderboard";

type LeaderboardTab = "streak" | "commits" | "prs";
type LeaderboardPeriod = "week" | "month" | "all";

interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  avatarUrl: string;
  profileUrl: string;
  streak: number;
  commits: number;
  prs: number;
  score: number;
  isSponsor: boolean;
}

const tabs: Array<{ id: LeaderboardTab; label: string; metric: string }> = [
  { id: "streak", label: "Streak", metric: "days" },
  { id: "commits", label: "Commits", metric: "commits" },
  { id: "prs", label: "PRs", metric: "pull requests" },
];

const periods: Record<LeaderboardPeriod, string> = {
  week: "this week",
  month: "this month",
  all: "all time",
};

function isLeaderboardPeriod(value: string | undefined): value is LeaderboardPeriod {
  return value === "week" || value === "month" || value === "all";
}

function leaderboardHref(
  tab: LeaderboardTab,
  filters: { lang?: string; period: LeaderboardPeriod }
): string {
  const params = new URLSearchParams({ tab });

  if (filters.lang) {
    params.set("lang", filters.lang);
  }

  if (filters.period !== "all") {
    params.set("period", filters.period);
  }

  return `/leaderboard?${params.toString()}`;
}

function getMetricValue(entry: LeaderboardEntry, tab: LeaderboardTab): number {
  if (tab === "streak") return entry.streak;
  if (tab === "commits") return entry.commits;
  return entry.prs;
}

// New: async sub-component that does the actual data fetching + rendering.
// This is the part that gets suspended while data loads.
async function LeaderboardTable({
  activeTab,
  filters,
}: {
  activeTab: LeaderboardTab;
  filters: { lang?: string; period: LeaderboardPeriod };
}) {
  const hasFilters = Boolean(filters.lang) || filters.period !== "all";

  let leaderboard = await getLeaderboardData(false, { period: filters.period });
  if (leaderboard && filters.lang) {
    leaderboard = await filterLeaderboardByLanguage(leaderboard, filters.lang);
  }

  const activeMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const rows = leaderboard?.leaders[activeTab] ?? [];
  const metricLabel = activeTab === "streak" ? activeMeta.metric : periods[filters.period];

  return (
    <>
      {leaderboard && (
        <div className="mb-2 text-right text-sm text-[var(--muted-foreground)]">
          Updated {new Date(leaderboard.generatedAt).toLocaleString()}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
        {!leaderboard ? (
          <EmptyState
            icon="⚠️"
            title="No leaderboard data available"
            description="Leaderboard data is temporarily unavailable."
            actionLabel="Sync Dashboard"
            actionHref="/dashboard"
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🏆"
            title={
              hasFilters
                ? "No leaderboard results for these filters"
                : "No public profiles yet"
            }
            description={
              hasFilters
                ? "Try a broader language or time filter, or clear filters to view the full leaderboard."
                : "No public profiles yet - be the first to enable yours in Settings!"
            }
            actionLabel="Go to Settings"
            actionHref="/dashboard/settings"
          />
        ) : (
          <>
            <div className="grid grid-cols-[72px_1fr_110px_110px] border-b border-[var(--border)] bg-[var(--control)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] md:grid-cols-[80px_1fr_140px_140px_120px]">
              <div>Rank</div>
              <div>Contributor</div>
              <div>{activeMeta.label}</div>
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
                    <div title={entry.username} className="flex max-w-[120px] items-center gap-2 truncate font-semibold text-[var(--card-foreground)] sm:max-w-[180px] md:max-w-none">
                      @{entry.username} {entry.isSponsor && <SponsorBadge />}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {entry.commits} commits, {entry.prs} PRs, {entry.streak}d streak
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-[var(--card-foreground)]">{getMetricValue(entry, activeTab)}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{metricLabel}</div>
                </div>
                <div className="hidden text-sm font-medium text-[var(--card-foreground)] md:block">{entry.score}</div>
                <div>
                  <Link href={entry.profileUrl} className="secondary-button inline-flex rounded-lg px-3 py-2 text-sm font-medium">
                    View
                  </Link>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </>
  );
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; lang?: string; period?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = tabs.some((tab) => tab.id === resolvedSearchParams.tab)
    ? (resolvedSearchParams.tab as LeaderboardTab)
    : "streak";
  const period = isLeaderboardPeriod(resolvedSearchParams.period)
    ? resolvedSearchParams.period
    : "all";
  const filters = { lang: resolvedSearchParams.lang, period };

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

        <Suspense key={`${activeTab}-${filters.lang ?? ""}-${filters.period}`} fallback={<LeaderboardSkeleton />}>
          <LeaderboardTable activeTab={activeTab} filters={filters} />
        </Suspense>
      </div>
    </main>
  );
}