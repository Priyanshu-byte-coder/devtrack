import Link from "next/link";

type LeaderboardSort = "streak" | "commits" | "prs" | "score";
type TimeRange = "7d" | "30d" | "90d" | "all";
type Scope = "global" | "repositories" | "organizations";

interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  profileUrl: string;
  streak: number;
  commits: number;
  prs: number;
  score: number;
}

interface LeaderboardPayload {
  generatedAt: string;
  refreshSeconds: number;
  query: {
    range: TimeRange;
    scope: Scope;
  };
  items: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const sortTabs: Array<{ id: LeaderboardSort; label: string; metric: string }> = [
  { id: "score", label: "Score", metric: "overall" },
  { id: "streak", label: "Streak", metric: "days" },
  { id: "commits", label: "Commits", metric: "in range" },
  { id: "prs", label: "PRs", metric: "in range" },
];

const ranges: Array<{ id: TimeRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "all", label: "All time" },
];

const limits = [10, 25, 50];

type LeaderboardPageSearchParams = {
  sort?: string;
  range?: string;
  scope?: string;
  page?: string;
  limit?: string;
};

function toQueryString(params: LeaderboardPageSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }
  return query.toString();
}

function buildLeaderboardHref(
  current: LeaderboardPageSearchParams,
  updates: Partial<LeaderboardPageSearchParams>
): string {
  const nextParams: LeaderboardPageSearchParams = { ...current, ...updates };
  return `/leaderboard?${toQueryString(nextParams)}`;
}

async function fetchLeaderboard(
  queryParams: LeaderboardPageSearchParams
): Promise<LeaderboardPayload | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  const query = toQueryString(queryParams);

  try {
    const res = await fetch(`${baseUrl}/api/leaderboard?${query}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as LeaderboardPayload;
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return null;
  }
}

function getMetricValue(entry: LeaderboardEntry, sort: LeaderboardSort): number {
  if (sort === "score") return entry.score;
  if (sort === "streak") return entry.streak;
  if (sort === "commits") return entry.commits;
  return entry.prs;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: LeaderboardPageSearchParams;
}) {
  const activeSort = sortTabs.some((tab) => tab.id === searchParams.sort)
    ? (searchParams.sort as LeaderboardSort)
    : "score";
  const activeRange = ranges.some((range) => range.id === searchParams.range)
    ? (searchParams.range as TimeRange)
    : "30d";
  const requestedPage = Number(searchParams.page ?? "1");
  const requestedLimit = Number(searchParams.limit ?? "25");
  const activePage = Number.isFinite(requestedPage) && requestedPage > 0
    ? String(Math.floor(requestedPage))
    : "1";
  const activeLimit = limits.includes(requestedLimit)
    ? String(requestedLimit)
    : "25";
  const activeScope: Scope = searchParams.scope === "repositories" || searchParams.scope === "organizations"
    ? searchParams.scope
    : "global";

  const currentParams: LeaderboardPageSearchParams = {
    sort: activeSort,
    range: activeRange,
    scope: activeScope,
    page: activePage,
    limit: activeLimit,
  };

  const leaderboard = await fetchLeaderboard(currentParams);
  const activeMeta = sortTabs.find((tab) => tab.id === activeSort) ?? sortTabs[0];
  const rows = leaderboard?.items ?? [];
  const pagination = leaderboard?.pagination;
  const startRow = pagination && rows.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endRow = pagination && rows.length > 0 ? startRow + rows.length - 1 : 0;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              DevTrack
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-[var(--foreground)] md:text-4xl">
              Public Leaderboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)] md:text-base">
              Opted-in developers ranked by score, streak, commits, and pull
              request activity with query-based filtering.
            </p>
          </div>

          {leaderboard && (
            <div className="text-sm text-[var(--muted-foreground)]">
              Updated {new Date(leaderboard.generatedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-2 shadow-[var(--shadow-soft)]">
          {sortTabs.map((tab) => {
            const active = tab.id === activeSort;
            return (
              <Link
                key={tab.id}
                href={buildLeaderboardHref(currentParams, {
                  sort: tab.id,
                  page: "1",
                })}
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

        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-2 shadow-[var(--shadow-soft)]">
          {ranges.map((range) => {
            const active = range.id === activeRange;
            return (
              <Link
                key={range.id}
                href={buildLeaderboardHref(currentParams, {
                  range: range.id,
                  page: "1",
                })}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] hover:bg-[var(--control)]"
                }`}
              >
                {range.label}
              </Link>
            );
          })}

          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--muted-foreground)] md:text-sm">
            <span>Rows</span>
            {limits.map((value) => {
              const active = Number(activeLimit) === value;
              return (
                <Link
                  key={value}
                  href={buildLeaderboardHref(currentParams, {
                    limit: String(value),
                    page: "1",
                  })}
                  className={`rounded-md border px-2 py-1 font-medium ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--control)]"
                  }`}
                >
                  {value}
                </Link>
              );
            })}
          </div>
        </div>

        {pagination && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted-foreground)]">
            <span>
              Showing {startRow}-{endRow} of {pagination.total}
            </span>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-[72px_1fr_110px_110px] border-b border-[var(--border)] bg-[var(--control)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] md:grid-cols-[80px_1fr_140px_140px_120px]">
            <div>Rank</div>
            <div>Contributor</div>
            <div>{activeMeta.label}</div>
            <div className="hidden md:block">Score</div>
            <div>Profile</div>
          </div>

          {!leaderboard ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
              Leaderboard data is temporarily unavailable.
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
              No opted-in public profiles yet.
            </div>
          ) : (
            rows.map((entry) => (
              <div
                key={`${activeSort}-${entry.username}`}
                className="grid grid-cols-[72px_1fr_110px_110px] items-center border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[80px_1fr_140px_140px_120px]"
              >
                <div className="text-lg font-bold text-[var(--card-foreground)]">
                  #{entry.rank}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full border border-[var(--border)]"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--card-foreground)]">
                      @{entry.username}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {entry.commits} commits · {entry.prs} PRs · {entry.streak}d
                      streak
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-[var(--card-foreground)]">
                    {getMetricValue(entry, activeSort)}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {activeMeta.metric}
                  </div>
                </div>
                <div className="hidden text-sm font-medium text-[var(--card-foreground)] md:block">
                  {entry.score}
                </div>
                <div>
                  <Link
                    href={entry.profileUrl}
                    className="secondary-button inline-flex rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </section>

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-2">
            {pagination.page > 1 ? (
              <Link
                href={buildLeaderboardHref(currentParams, {
                  page: String(pagination.page - 1),
                })}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--control)]"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)]">
                Previous
              </span>
            )}

            {pagination.page < pagination.totalPages ? (
              <Link
                href={buildLeaderboardHref(currentParams, {
                  page: String(pagination.page + 1),
                })}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--control)]"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted-foreground)]">
                Next
              </span>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

