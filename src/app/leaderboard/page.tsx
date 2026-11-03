import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import EmptyState from "@/components/EmptyState";
import { Reveal } from "@/components/motion/Reveal";
import { stagger } from "@/lib/motion";
import LeaderboardFilters from "@/components/leaderboard/LeaderboardFilters";
import LeaderboardSkeleton from "@/app/leaderboard/LeaderboardSkeleton";
import SponsorBadge from "@/components/SponsorBadge";
import { arcadeTabClass, arcadeTabGroupClass } from "@/components/ui/arcade";
import Podium, { type PodiumPlace } from "@/components/leaderboard/Podium";
import DevLookup from "@/components/landing/arcade/DevLookup";
import SponsorSlot from "@/components/sponsor/SponsorSlot";
import { SIGN_IN_HREF } from "@/components/landing/arcade/types";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import {
  getLeaderboardData,
  filterLeaderboardByLanguage,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
import {
  biggestClimbers,
  rankEntriesByScoreV2,
  rankMovement,
  type Climber,
} from "@/lib/gamification/ranking";
import {
  getBaselineRanks,
  getProgressByUserIds,
} from "@/lib/gamification/queries";
import TierBadge from "@/components/gamification/TierBadge";
import LevelChip from "@/components/gamification/LevelChip";
import RankMovementBadge from "@/components/gamification/RankMovementBadge";
import { JsonLd, leaderboardJsonLd } from "@/lib/seo/json-ld";

export const metadata: Metadata = {
  title: "Global developer leaderboard",
  description:
    "See who leads DevTrack worldwide by coding streak, commits and merged pull requests. Filter by language and time period.",
  // Tab and filter query strings are views of the same page.
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "Global developer leaderboard · DevTrack",
    description:
      "Who has the longest streak, the most commits and the most merged PRs on DevTrack?",
    url: "/leaderboard",
  },
};

type LeaderboardTab = "overall" | "streak" | "commits" | "prs";
type LeaderboardPeriod = "week" | "month" | "all";

const tabs: Array<{ id: LeaderboardTab; label: string; metric: string }> = [
  { id: "overall", label: "Overall", metric: "score" },
  { id: "streak", label: "Streak", metric: "days" },
  { id: "commits", label: "Commits", metric: "commits" },
  { id: "prs", label: "PRs", metric: "pull requests" },
];

const periods: Record<LeaderboardPeriod, string> = {
  week: "this week",
  month: "this month",
  all: "all time",
};

const fmt = new Intl.NumberFormat("en-US");

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
  if (tab === "overall") return entry.scoreV2 ?? 0;
  if (tab === "streak") return entry.streak;
  if (tab === "commits") return entry.commits;
  return entry.prs;
}

/** Days left in the current monthly season, counting today. */
function seasonDaysLeft(now = new Date()) {
  const last = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return last - now.getUTCDate() + 1;
}

async function viewerLogin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return typeof session?.githubLogin === "string"
    ? session.githubLogin.toLowerCase()
    : null;
}

/** Larger avatar for the podium; leaderboard avatars are requested at 96px. */
function podiumAvatar(url: string) {
  return url.replace(/([?&])s=\d+/, "$1s=144");
}

// The part that suspends while data loads.
async function LeaderboardTable({
  activeTab,
  filters,
  viewer,
}: {
  activeTab: LeaderboardTab;
  filters: { lang?: string; period: LeaderboardPeriod };
  viewer: string | null;
}) {
  const hasFilters = Boolean(filters.lang) || filters.period !== "all";

  let leaderboard = await getLeaderboardData(false, { period: filters.period });
  if (leaderboard && filters.lang) {
    leaderboard = await filterLeaderboardByLanguage(leaderboard, filters.lang);
  }

  const activeMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  // Overall ranks everyone by score v2. A cached board built before score v2
  // existed has nothing to rank by, so it falls back to the commits board
  // rather than showing an empty table until the cache refreshes.
  const overall = leaderboard
    ? rankEntriesByScoreV2(Object.values(leaderboard.leaders).flat()).map(
        (e) => ({
          ...e,
          rank: e.rankV2,
        })
      )
    : [];
  const rows: LeaderboardEntry[] = !leaderboard
    ? []
    : activeTab === "overall"
      ? overall.length > 0
        ? overall
        : leaderboard.leaders.commits
      : leaderboard.leaders[activeTab];
  const metricLabel =
    activeTab === "streak" || activeTab === "overall"
      ? activeMeta.metric
      : periods[filters.period];

  // Movement compares overall ranks with the last daily snapshot. A language
  // filter re-ranks a subset, which isn't comparable to the global snapshot.
  const showMovement =
    activeTab === "overall" && overall.length > 0 && !filters.lang;
  const [baseline, progress] = await Promise.all([
    showMovement
      ? getBaselineRanks(filters.period, new Date().toISOString().slice(0, 10))
      : Promise.resolve({ date: null, ranks: {} as Record<string, number> }),
    getProgressByUserIds(rows.map((r) => r.id)),
  ]);
  const baselineLabel = baseline.date
    ? new Date(`${baseline.date}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : undefined;

  const isYou = (entry: LeaderboardEntry) =>
    viewer !== null && entry.username.toLowerCase() === viewer;
  const podium: PodiumPlace[] = rows.slice(0, 3).map((entry) => ({
    username: entry.username,
    avatarUrl: podiumAvatar(entry.avatarUrl),
    profileUrl: entry.profileUrl,
    value: fmt.format(getMetricValue(entry, activeTab)),
    valueLabel: metricLabel,
    tier: entry.tier,
    scoreV2: entry.scoreV2,
    isYou: isYou(entry),
  }));
  const rest = rows.slice(3);
  const climbers = showMovement
    ? biggestClimbers(rows, baseline.ranks, baseline.date !== null)
    : [];
  const viewerOnBoard = rows.some(isYou);

  return (
    <>
      {!hasFilters && rows.length > 0 && (
        <JsonLd data={leaderboardJsonLd(rows.slice(0, 50))} />
      )}

      {!leaderboard ? (
        <div className="px-frame bg-[var(--card)] px-4 py-12 text-center">
          <p className="font-pixel text-sm uppercase text-[var(--card-foreground)]">
            Connection lost
          </p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Leaderboard data is temporarily unavailable.
          </p>
          <Link href="/leaderboard" className="px-btn mt-6">
            Retry
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-frame bg-[var(--card)]">
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
        </div>
      ) : (
        <>
          <Podium places={podium} />

          {climbers.length > 0 && (
            <Climbers climbers={climbers} since={baselineLabel} />
          )}

          {rest.length > 0 && (
            <section
              aria-label={`Ranks 4 to ${rows.length}`}
              className="px-frame bg-[var(--card)]"
            >
              {/* Column headings only make sense once the row is a real
                  table; below `sm` each row reads as a card instead. */}
              <div
                aria-hidden="true"
                className="hidden border-b-4 border-dotted border-[var(--border)] px-4 py-3 font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] sm:flex sm:items-center sm:gap-3"
              >
                <span className="w-12 shrink-0">Rank</span>
                <span className="w-9 shrink-0" />
                <span className="min-w-0 flex-1">Player</span>
                <span className="w-24 shrink-0 text-right">
                  {activeMeta.label}
                </span>
                <span className="hidden w-16 shrink-0 text-right md:block">
                  Level
                </span>
              </div>

              <ul className="divide-y-2 divide-dashed divide-[var(--border)]">
                {rest.map((entry, index) => {
                  const you = isYou(entry);
                  return (
                    <Reveal
                      as="li"
                      key={entry.id}
                      className={`relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--control)] ${
                        you
                          ? "bg-accent/10 shadow-[inset_4px_0_0_0_var(--accent)]"
                          : ""
                      }`}
                      y={8}
                      amount={0}
                      // The first screenful cascades in; rows further down
                      // just appear as they scroll into view.
                      delay={index < 15 ? index * stagger.tight : 0}
                    >
                      <span className="flex w-9 shrink-0 flex-col items-start gap-1 sm:w-12">
                        <span className="font-pixel text-sm tabular-nums text-[var(--muted-foreground)] sm:text-base">
                          {String(entry.rank).padStart(2, "0")}
                        </span>
                        {showMovement && (
                          <RankMovementBadge
                            movement={rankMovement(
                              entry.rank,
                              baseline.ranks[entry.id],
                              baseline.date !== null
                            )}
                            since={baselineLabel}
                          />
                        )}
                      </span>

                      <Image
                        src={entry.avatarUrl}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="h-9 w-9 shrink-0 bg-[var(--control)]"
                      />

                      {/* min-w-0 lets long usernames truncate instead of
                          forcing the row wider than the screen. */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {/* The whole row is the link, via the overlay. */}
                          <Link
                            href={entry.profileUrl}
                            title={entry.username}
                            className="truncate font-mono text-sm font-semibold text-[var(--card-foreground)] after:absolute after:inset-0 hover:text-[var(--accent)] focus-visible:text-[var(--accent)] focus-visible:underline focus-visible:outline-none"
                          >
                            @{entry.username}
                          </Link>
                          {you && (
                            <span className="shrink-0 font-pixel text-[10px] uppercase text-[var(--accent)]">
                              You
                            </span>
                          )}
                          {entry.tier && (
                            <TierBadge
                              tier={entry.tier}
                              score={entry.scoreV2}
                              compact
                            />
                          )}
                          {entry.isSponsor && (
                            <SponsorBadge
                              className="shrink-0"
                              labelClassName="hidden sm:inline"
                            />
                          )}
                        </div>

                        {/* On a phone the metric has no column of its own,
                            so it leads the secondary line instead. */}
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          <span className="font-semibold text-[var(--card-foreground)] sm:hidden">
                            {fmt.format(getMetricValue(entry, activeTab))}{" "}
                            {metricLabel}
                            {" · "}
                          </span>
                          {fmt.format(entry.commits)} commits ·{" "}
                          {fmt.format(entry.prs)} PRs · {entry.streak}d streak
                        </p>
                      </div>

                      <div className="hidden w-24 shrink-0 text-right sm:block">
                        <div className="font-pixel text-base tabular-nums text-[var(--card-foreground)]">
                          {fmt.format(getMetricValue(entry, activeTab))}
                        </div>
                        <div className="truncate text-xs text-[var(--muted-foreground)]">
                          {metricLabel}
                        </div>
                      </div>

                      <div className="hidden w-16 shrink-0 justify-end md:flex">
                        {(progress[entry.id]?.level ?? entry.level) !==
                          undefined && (
                          <LevelChip
                            level={progress[entry.id]?.level ?? entry.level!}
                          />
                        )}
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
            </section>
          )}

          <p className="mt-3 text-right font-pixel text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Updated{" "}
            {new Date(leaderboard.generatedAt).toLocaleString("en-US", {
              timeZone: "UTC",
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            UTC
          </p>
        </>
      )}

      <SponsorSlot className="mt-8" />

      {!viewerOnBoard && <JoinPanel signedIn={viewer !== null} />}
    </>
  );
}

/** Who moved up the most since the last daily snapshot. */
function Climbers({
  climbers,
  since,
}: {
  climbers: Climber[];
  since?: string;
}) {
  return (
    <section
      aria-labelledby="climbers-heading"
      className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-2 border-dashed border-[var(--border)] px-4 py-3"
    >
      <h2
        id="climbers-heading"
        className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
      >
        Biggest climbers{since ? ` since ${since}` : ""}
      </h2>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {climbers.map((c) => (
          <li key={c.username} className="flex items-center gap-2 text-sm">
            <span className="font-pixel text-sm text-[var(--success)]">
              <span aria-hidden="true">▲</span>
              <span className="sr-only">Up </span>
              {c.places}
            </span>
            <Link
              href={`/u/${c.username.toLowerCase()}`}
              className="font-mono font-semibold text-[var(--card-foreground)] hover:text-[var(--accent)]"
            >
              @{c.username}
            </Link>
            <span className="text-xs text-[var(--muted-foreground)]">
              now #{c.rank}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** For anyone not on the board: how to get on it, or where they'd land. */
function JoinPanel({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      aria-labelledby="join-heading"
      className="px-frame px-frame-accent mt-10 grid gap-8 bg-[var(--card)] p-6 md:grid-cols-2 md:items-center"
    >
      <div className="min-w-0">
        <h2
          id="join-heading"
          className="font-pixel text-2xl uppercase leading-none text-[var(--card-foreground)]"
        >
          Not on the board?
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          {signedIn
            ? "Make your profile public and join in one click. Your rank appears with the next daily update."
            : "Sign in with GitHub and join in one click. Your rank, tier and XP come from the activity you already have."}
        </p>
        <div className="-m-1 mt-5">
          {signedIn ? (
            <Link href="/claim" className="px-btn">
              Join the leaderboard
            </Link>
          ) : (
            <a href={SIGN_IN_HREF} className="px-btn">
              Press start
            </a>
          )}
        </div>
      </div>
      <DevLookup className="min-w-0" />
    </section>
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
    : "overall";
  const period = isLeaderboardPeriod(resolvedSearchParams.period)
    ? resolvedSearchParams.period
    : "all";
  const filters = { lang: resolvedSearchParams.lang, period };
  const viewer = await viewerLogin();
  const daysLeft = seasonDaysLeft();
  const seasonName = new Date().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
            Hi-scores · worldwide
          </p>
          <h1 className="mt-2 font-pixel text-[clamp(2rem,5vw,3.25rem)] uppercase leading-none text-[var(--foreground)]">
            Leaderboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
            Public developers ranked by DevTrack score: consistency, impact,
            volume and breadth. Switch tabs to rank by a single stat.
          </p>
        </div>
        <Link
          href={leaderboardHref(activeTab, { ...filters, period: "month" })}
          className="px-frame bg-[var(--card)] px-4 py-3 text-right transition-colors hover:bg-[var(--control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="block font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Season · {seasonName}
          </span>
          <span className="mt-1 block font-pixel text-lg uppercase text-[var(--card-foreground)]">
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left
          </span>
        </Link>
      </header>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Ranking" className={arcadeTabGroupClass}>
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={leaderboardHref(tab.id, filters)}
                aria-current={active ? "page" : undefined}
                className={arcadeTabClass(active)}
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
        <LeaderboardTable
          activeTab={activeTab}
          filters={filters}
          viewer={viewer}
        />
      </Suspense>
    </>
  );
}
