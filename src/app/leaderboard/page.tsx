import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import EmptyState from "@/components/EmptyState";
import LeaderboardFilters from "@/components/leaderboard/LeaderboardFilters";
import LeaderboardSkeleton from "@/app/leaderboard/LeaderboardSkeleton";
import SponsorBadge from "@/components/SponsorBadge";
import PageHeader from "@/components/shell/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import {
  segmentedGroupClass,
  segmentedItemClass,
} from "@/components/ui/segmented";
import {
  getLeaderboardData,
  filterLeaderboardByLanguage,
  type LeaderboardPayload,
} from "@/lib/leaderboard";

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

function isLeaderboardPeriod(
  value: string | undefined
): value is LeaderboardPeriod {
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
  const metricLabel =
    activeTab === "streak" ? activeMeta.metric : periods[filters.period];

  return (
    <>
      {leaderboard && (
        <p className="mb-2 text-right text-xs text-[var(--muted-foreground)]">
          Updated {new Date(leaderboard.generatedAt).toLocaleString()}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        {!leaderboard ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              Leaderboard data is temporarily unavailable.
            </p>
            <Link
              href="/leaderboard"
              className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Retry
            </Link>
          </div>
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
            {/* Column headings only make sense once the row is a real table;
                below `sm` each row reads as a card instead. */}
            <div
              aria-hidden="true"
              className="hidden border-b border-[var(--border)] bg-[var(--control)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] sm:flex sm:items-center sm:gap-3"
            >
              <span className="w-10 shrink-0">Rank</span>
              <span className="w-10 shrink-0" />
              <span className="min-w-0 flex-1">Contributor</span>
              <span className="w-24 shrink-0 text-right">
                {activeMeta.label}
              </span>
              <span className="hidden w-16 shrink-0 text-right md:block">
                Score
              </span>
              <span className="w-[4.5rem] shrink-0 text-right">Profile</span>
            </div>

            <ul className="divide-y divide-[var(--border)]">
              {rows.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="w-7 shrink-0 text-sm font-semibold tabular-nums text-[var(--muted-foreground)] sm:w-10 sm:text-base">
                    #{entry.rank}
                  </span>

                  <Image
                    src={entry.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 shrink-0 rounded-full border border-[var(--border)]"
                  />

                  {/* min-w-0 lets the long usernames actually truncate instead
                      of forcing the row wider than the screen. */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        title={entry.username}
                        className="truncate font-semibold text-[var(--card-foreground)]"
                      >
                        @{entry.username}
                      </span>
                      {entry.isSponsor && (
                        <SponsorBadge
                          className="shrink-0"
                          labelClassName="hidden sm:inline"
                        />
                      )}
                    </div>

                    {/* On a phone the metric has no column of its own, so it
                        leads the secondary line instead. */}
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      <span className="font-semibold text-[var(--card-foreground)] sm:hidden">
                        {getMetricValue(entry, activeTab)} {metricLabel}
                        {" · "}
                      </span>
                      {entry.commits} commits · {entry.prs} PRs · {entry.streak}
                      d streak
                    </p>
                  </div>

                  <div className="hidden w-24 shrink-0 text-right sm:block">
                    <div className="text-base font-semibold tabular-nums text-[var(--card-foreground)]">
                      {getMetricValue(entry, activeTab)}
                    </div>
                    <div className="truncate text-xs text-[var(--muted-foreground)]">
                      {metricLabel}
                    </div>
                  </div>

                  <div className="hidden w-16 shrink-0 text-right text-sm font-medium tabular-nums text-[var(--card-foreground)] md:block">
                    {entry.score}
                  </div>

                  <Link
                    href={entry.profileUrl}
                    aria-label={`View ${entry.username}'s profile`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-[4.5rem] shrink-0 justify-center",
                    })}
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
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
    <>
      <PageHeader
        title="Leaderboard"
        description="Developers who made their profile public, ranked by streak, commits and pull requests."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Ranking" className={segmentedGroupClass}>
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={leaderboardHref(tab.id, filters)}
                aria-current={active ? "page" : undefined}
                className={segmentedItemClass(active)}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Suspense fallback={null}>
          <LeaderboardFilters />
        </Suspense>
      </div>

      <Suspense
        key={`${activeTab}-${filters.lang ?? ""}-${filters.period}`}
        fallback={<LeaderboardSkeleton />}
      >
        <LeaderboardTable activeTab={activeTab} filters={filters} />
      </Suspense>
    </>
  );
}
