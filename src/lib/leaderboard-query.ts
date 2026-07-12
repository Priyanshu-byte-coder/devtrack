export type LeaderboardMetric = "streak" | "commits" | "prs";

export type TimeRange = "7d" | "30d" | "90d" | "all";
export type Scope = "global" | "repositories" | "organizations";

export interface LeaderboardQuery {
  page: number;
  limit: number;
  sort: LeaderboardMetric | "score";
  range: TimeRange;
  scope: Scope;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl: string;
  profileUrl: string;
  streak: number;
  commits: number;
  prs: number;
  score: number;
}

export interface LeaderboardPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_QUERY: LeaderboardQuery = {
  page: 1,
  limit: 25,
  sort: "score",
  range: "30d",
  scope: "global",
};

const MIN_LIMIT = 10;
const MAX_LIMIT = 100;
const MIN_PAGE = 1;

export function parseLeaderboardQueryFromSearchParams(
  params: URLSearchParams
): LeaderboardQuery {
  const pageInput = Number(params.get("page") ?? DEFAULT_QUERY.page);
  const limitInput = Number(params.get("limit") ?? DEFAULT_QUERY.limit);

  const sortParam = params.get("sort");
  const rangeParam = params.get("range");
  const scopeParam = params.get("scope");

  return {
    page:
      Number.isFinite(pageInput) && pageInput >= MIN_PAGE
        ? Math.floor(pageInput)
        : DEFAULT_QUERY.page,
    limit:
      Number.isFinite(limitInput) && limitInput >= MIN_LIMIT
        ? Math.min(MAX_LIMIT, Math.floor(limitInput))
        : DEFAULT_QUERY.limit,
    sort:
      sortParam === "streak" ||
      sortParam === "commits" ||
      sortParam === "prs" ||
      sortParam === "score"
        ? sortParam
        : DEFAULT_QUERY.sort,
    range:
      rangeParam === "7d" ||
      rangeParam === "30d" ||
      rangeParam === "90d" ||
      rangeParam === "all"
        ? rangeParam
        : DEFAULT_QUERY.range,
    scope:
      scopeParam === "repositories" || scopeParam === "organizations"
        ? scopeParam
        : DEFAULT_QUERY.scope,
  };
}

export function getRangeStartDate(range: TimeRange, now = new Date()): string {
  const MS_PER_DAY = 86400000;
  if (range === "all") {
    return "2008-01-01";
  }

  const dayCount = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const since = new Date(now.getTime() - dayCount * MS_PER_DAY);
  return since.toISOString().slice(0, 10);
}

export function applyLeaderboardQuery(
  entries: LeaderboardEntry[],
  query: LeaderboardQuery
): { items: LeaderboardEntry[]; pagination: LeaderboardPagination } {
  const ranked = [...entries].sort((a, b) => {
    if (query.sort === "score") {
      return b.score - a.score || b.commits - a.commits || b.streak - a.streak;
    }
    return b[query.sort] - a[query.sort] || b.score - a.score;
  });

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.limit;
  const items = ranked.slice(start, start + query.limit).map((entry, index) => ({
    ...entry,
    rank: start + index + 1,
  }));

  return {
    items,
    pagination: {
      page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
}

export function buildLeaderboardCacheKey(query: Pick<LeaderboardQuery, "range" | "scope">): string {
  return `leaderboard:v2:${query.range}:${query.scope}`;
}
