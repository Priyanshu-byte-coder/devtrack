/**
 * Pull request analytics from one GraphQL request: the PRs you opened in the
 * range, the ones still open, and the reviews you gave. Pure functions here;
 * the route does the fetching and caching.
 */

export type PullRequestRange = "7d" | "30d" | "90d";

export const RANGE_DAYS: Record<PullRequestRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export interface PullRequestNode {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  repository: { nameWithOwner: string };
  reviews: {
    nodes: Array<{
      submittedAt: string | null;
      author: { login: string } | null;
    }>;
  };
}

export interface ReviewContributionNode {
  pullRequestReview: { state: string } | null;
  repository: { nameWithOwner: string } | null;
}

/** What one account's GraphQL request returns, before summarising. */
export interface PullRequestRaw {
  login: string;
  inRange: PullRequestNode[];
  inRangeTotal: number;
  openNow: PullRequestNode[];
  openTotal: number;
  reviews: ReviewContributionNode[];
  reviewsTotal: number;
}

export const PULL_REQUESTS_QUERY = `
query PullRequests($inRange: String!, $open: String!, $login: String!, $from: DateTime!) {
  inRange: search(query: $inRange, type: ISSUE, first: 100) {
    issueCount
    nodes { ...PR }
  }
  openNow: search(query: $open, type: ISSUE, first: 30) {
    issueCount
    nodes { ...PR }
  }
  user(login: $login) {
    contributionsCollection(from: $from) {
      pullRequestReviewContributions(first: 100) {
        totalCount
        nodes {
          pullRequestReview { state }
          repository { nameWithOwner }
        }
      }
    }
  }
}
fragment PR on PullRequest {
  number
  title
  url
  state
  isDraft
  createdAt
  mergedAt
  closedAt
  additions
  deletions
  repository { nameWithOwner }
  reviews(first: 10) { nodes { submittedAt author { login } } }
}`;

/** Search qualifiers shared by both PR searches, honouring org settings. */
export function pullRequestQueries(
  login: string,
  since: string,
  options: { org?: string | null; excludedOrgs?: string[] } = {}
) {
  const scope = options.org
    ? ` org:${options.org}`
    : (options.excludedOrgs ?? []).map((org) => ` -org:${org}`).join("");
  return {
    inRange: `is:pr author:${login} created:>=${since}${scope} sort:created-desc`,
    open: `is:pr author:${login} is:open${scope} sort:created-asc`,
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function hoursBetween(from: string, to: string): number | null {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms / HOUR : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (n: number | null) =>
  n === null ? null : Math.round(n * 10) / 10;

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

/** First review by someone other than the author, in hours after opening. */
function hoursToFirstReview(
  pr: PullRequestNode,
  author: string
): number | null {
  const times = pr.reviews.nodes
    .filter(
      (r) =>
        r.submittedAt && r.author?.login.toLowerCase() !== author.toLowerCase()
    )
    .map((r) => new Date(r.submittedAt!).getTime())
    .filter(Number.isFinite);
  if (times.length === 0) return null;
  return hoursBetween(pr.createdAt, new Date(Math.min(...times)).toISOString());
}

function dedupe(nodes: PullRequestNode[]): PullRequestNode[] {
  const seen = new Map<string, PullRequestNode>();
  for (const node of nodes)
    if (node?.url && !seen.has(node.url)) seen.set(node.url, node);
  return [...seen.values()];
}

export interface PullRequestSummary {
  range: PullRequestRange;
  // Opened in the range, by outcome.
  opened: number;
  merged: number;
  closed: number;
  stillOpen: number;
  /** Merged share of PRs opened in the range that have been decided. */
  mergeRate: number | null;
  medianHoursToMerge: number | null;
  medianHoursToFirstReview: number | null;
  additions: number;
  deletions: number;
  /** True when GitHub had more PRs in the range than one request returns. */
  sampled: boolean;
  openNow: number;
  draftsNow: number;
  weeks: Array<{ weekStart: string; opened: number; merged: number }>;
  repos: Array<{ repo: string; opened: number; merged: number }>;
  openList: Array<{
    title: string;
    url: string;
    repo: string;
    number: number;
    ageDays: number;
    isDraft: boolean;
    reviewed: boolean;
  }>;
  recentMerged: Array<{
    title: string;
    url: string;
    repo: string;
    number: number;
    mergedAt: string;
    hoursToMerge: number | null;
  }>;
  reviews: {
    total: number;
    approved: number;
    changesRequested: number;
    commented: number;
    topRepos: Array<{ repo: string; count: number }>;
  };
}

export function summarizePullRequests(
  raws: PullRequestRaw[],
  range: PullRequestRange,
  now = new Date()
): PullRequestSummary {
  const logins = new Set(raws.map((r) => r.login.toLowerCase()));
  const authorOf = (pr: PullRequestNode) =>
    raws.find((r) => r.inRange.includes(pr) || r.openNow.includes(pr))?.login ??
    [...logins][0] ??
    "";
  const inRange = dedupe(raws.flatMap((r) => r.inRange));
  const openNow = dedupe(raws.flatMap((r) => r.openNow));

  const mergedPRs = inRange.filter(
    (pr) => pr.state === "MERGED" && pr.mergedAt
  );
  const closedPRs = inRange.filter((pr) => pr.state === "CLOSED");
  const decided = mergedPRs.length + closedPRs.length;

  const mergeHours = mergedPRs
    .map((pr) => hoursBetween(pr.createdAt, pr.mergedAt!))
    .filter((h): h is number => h !== null);
  const reviewHours = inRange
    .map((pr) => hoursToFirstReview(pr, authorOf(pr)))
    .filter((h): h is number => h !== null);

  // Every calendar week in the range, oldest first, even the empty ones.
  const days = RANGE_DAYS[range];
  const weeks = new Map<string, { opened: number; merged: number }>();
  for (
    let w = weekStart(new Date(now.getTime() - (days - 1) * DAY));
    w.getTime() <= now.getTime();
    w = new Date(w.getTime() + 7 * DAY)
  )
    weeks.set(w.toISOString().slice(0, 10), { opened: 0, merged: 0 });
  for (const pr of inRange) {
    const opened = weeks.get(
      weekStart(new Date(pr.createdAt)).toISOString().slice(0, 10)
    );
    if (opened) opened.opened += 1;
    if (pr.mergedAt) {
      const merged = weeks.get(
        weekStart(new Date(pr.mergedAt)).toISOString().slice(0, 10)
      );
      if (merged) merged.merged += 1;
    }
  }

  const repoMap = new Map<string, { opened: number; merged: number }>();
  for (const pr of inRange) {
    const entry = repoMap.get(pr.repository.nameWithOwner) ?? {
      opened: 0,
      merged: 0,
    };
    entry.opened += 1;
    if (pr.state === "MERGED") entry.merged += 1;
    repoMap.set(pr.repository.nameWithOwner, entry);
  }

  const reviewNodes = raws.flatMap((r) => r.reviews);
  const reviewRepos = new Map<string, number>();
  let approved = 0;
  let changesRequested = 0;
  let commented = 0;
  for (const node of reviewNodes) {
    const state = node.pullRequestReview?.state;
    if (state === "APPROVED") approved += 1;
    else if (state === "CHANGES_REQUESTED") changesRequested += 1;
    else if (state === "COMMENTED") commented += 1;
    const repo = node.repository?.nameWithOwner;
    if (repo) reviewRepos.set(repo, (reviewRepos.get(repo) ?? 0) + 1);
  }

  return {
    range,
    opened: inRange.length,
    merged: mergedPRs.length,
    closed: closedPRs.length,
    stillOpen: inRange.filter((pr) => pr.state === "OPEN").length,
    mergeRate: decided > 0 ? mergedPRs.length / decided : null,
    medianHoursToMerge: round1(median(mergeHours)),
    medianHoursToFirstReview: round1(median(reviewHours)),
    additions: inRange.reduce((sum, pr) => sum + (pr.additions || 0), 0),
    deletions: inRange.reduce((sum, pr) => sum + (pr.deletions || 0), 0),
    sampled: raws.some((r) => r.inRangeTotal > r.inRange.length),
    openNow: raws.reduce((sum, r) => sum + r.openTotal, 0),
    draftsNow: openNow.filter((pr) => pr.isDraft).length,
    weeks: [...weeks].map(([start, counts]) => ({
      weekStart: start,
      ...counts,
    })),
    repos: [...repoMap]
      .map(([repo, counts]) => ({ repo, ...counts }))
      .sort((a, b) => b.opened - a.opened || a.repo.localeCompare(b.repo))
      .slice(0, 5),
    openList: openNow
      .map((pr) => ({
        title: pr.title,
        url: pr.url,
        repo: pr.repository.nameWithOwner,
        number: pr.number,
        ageDays: Math.max(
          0,
          Math.floor((now.getTime() - new Date(pr.createdAt).getTime()) / DAY)
        ),
        isDraft: pr.isDraft,
        reviewed: hoursToFirstReview(pr, authorOf(pr)) !== null,
      }))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 8),
    recentMerged: mergedPRs
      .sort((a, b) => b.mergedAt!.localeCompare(a.mergedAt!))
      .slice(0, 5)
      .map((pr) => ({
        title: pr.title,
        url: pr.url,
        repo: pr.repository.nameWithOwner,
        number: pr.number,
        mergedAt: pr.mergedAt!,
        hoursToMerge: round1(hoursBetween(pr.createdAt, pr.mergedAt!)),
      })),
    reviews: {
      total: raws.reduce((sum, r) => sum + r.reviewsTotal, 0),
      approved,
      changesRequested,
      commented,
      topRepos: [...reviewRepos]
        .map(([repo, count]) => ({ repo, count }))
        .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo))
        .slice(0, 5),
    },
  };
}

/**
 * The fields other features (personality, export, insights) have always
 * read from /api/metrics/prs, derived from the summary.
 */
export function legacyPullRequestFields(summary: PullRequestSummary) {
  const avgMerge = summary.medianHoursToMerge ?? 0;
  const mergeRatePct =
    summary.mergeRate === null ? 0 : Math.round(summary.mergeRate * 100);
  return {
    open: summary.openNow,
    merged: summary.merged,
    closed: summary.closed,
    total: summary.opened,
    totalAdditions: summary.additions,
    totalDeletions: summary.deletions,
    avgReviewHours: Math.round(avgMerge),
    avgFirstReviewHours: summary.medianHoursToFirstReview,
    mergeRate: `${mergeRatePct}%`,
  };
}
