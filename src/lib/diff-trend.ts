/**
 * Pure helpers for the weekly lines added/removed chart (issue #174).
 *
 * Line counts come from GitHub's `GET /repos/{owner}/{repo}/stats/contributors`,
 * which reports additions and deletions per author per week. Weeks start on
 * Sunday 00:00 UTC and are keyed by that instant in Unix seconds (`w`).
 */

/** Weeks shown on the chart, the current (partial) week included. */
export const DIFF_TREND_WEEKS = 12;
/** Repositories, ranked by the user's recent commits, whose lines are counted. */
export const DIFF_TREND_REPO_LIMIT = 3;

const WEEK_SECONDS = 7 * 24 * 60 * 60;

export interface DiffTrendWeek {
  /** Sunday that starts the week, YYYY-MM-DD (UTC). */
  weekStart: string;
  additions: number;
  deletions: number;
}

export interface DiffTrendResponse {
  weeks: DiffTrendWeek[];
  /** Repositories whose lines are included, most commits first. */
  repos: string[];
}

/** One entry of the `stats/contributors` response. */
export interface ContributorStats {
  author: { login: string } | null;
  weeks: Array<{ w: number; a: number; d: number; c: number }>;
}

/** Start of each charted week (Unix seconds, Sunday 00:00 UTC), oldest first. */
export function diffTrendWeekStarts(
  now: Date,
  weeks: number = DIFF_TREND_WEEKS
): number[] {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const currentWeek = today / 1000 - now.getUTCDay() * 24 * 60 * 60;
  return Array.from(
    { length: weeks },
    (_, i) => currentWeek - (weeks - 1 - i) * WEEK_SECONDS
  );
}

/** The repositories with the most commits, ties broken by name. */
export function topCommitRepos(
  items: Array<{ repository?: { full_name: string } }>,
  limit: number = DIFF_TREND_REPO_LIMIT
): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = item.repository?.full_name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * The given author's weeks from a `stats/contributors` response, or null when
 * they are not listed (GitHub only returns the top 100 contributors).
 */
export function authorWeeks(
  stats: ContributorStats[],
  login: string
): ContributorStats["weeks"] | null {
  const author = login.toLowerCase();
  const entry = stats.find(
    (contributor) => contributor.author?.login.toLowerCase() === author
  );
  return entry ? entry.weeks : null;
}

/**
 * True when weeks in the window have commits but no line counts at all.
 * GitHub reports zero additions and deletions for repositories with 10,000 or
 * more commits, so counting such a repository would understate the chart.
 */
export function lacksLineCounts(
  weeks: ContributorStats["weeks"],
  weekStarts: number[]
): boolean {
  const window = new Set(weekStarts);
  let commits = 0;
  for (const week of weeks) {
    if (!window.has(week.w)) continue;
    if (week.a > 0 || week.d > 0) return false;
    commits += week.c;
  }
  return commits > 0;
}

/** Sums each repository's additions and deletions into the charted weeks. */
export function buildDiffTrendWeeks(
  weekStarts: number[],
  repoWeeks: Array<ContributorStats["weeks"]>
): DiffTrendWeek[] {
  const totals = new Map(
    weekStarts.map((start) => [start, { additions: 0, deletions: 0 }])
  );
  for (const weeks of repoWeeks) {
    for (const week of weeks) {
      const total = totals.get(week.w);
      if (!total) continue;
      total.additions += week.a;
      total.deletions += week.d;
    }
  }
  return weekStarts.map((start) => ({
    weekStart: new Date(start * 1000).toISOString().slice(0, 10),
    ...totals.get(start)!,
  }));
}

/** The Saturday that ends the week starting on `weekStart`, e.g. "Nov 14". */
export function weekEndingLabel(weekStart: string): string {
  const end = new Date(`${weekStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
