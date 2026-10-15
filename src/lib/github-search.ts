import "server-only";
import { githubRequest } from "@/lib/github-request";
import { GitHubAuthError } from "@/lib/github-fetch";
import { GitHubRateLimitError } from "@/lib/github-rate-limit";
export type SearchResult<T> = {
  items: T[];
  total: number;
  complete: boolean;
  partialReason?: string;
  retryAfter?: number;
};
export type AuthorCommitItem = { commit: { author: { date: string } } };

/** Results cut short by a rate limit must surface as one, never be cached as complete. */
export function requireUnthrottled<T>(
  result: SearchResult<T>
): SearchResult<T> {
  if (result.retryAfter !== undefined)
    throw new GitHubRateLimitError(
      new Date(Date.now() + result.retryAfter * 1000),
      result.retryAfter
    );
  return result;
}

const COMMIT_TIMELINE_DAYS = 366;
const HISTORY_BATCH = 20;
const HISTORY_ROUNDS = 20;

type TimelineCommit = {
  sha: string;
  html_url: string;
  commit: { author: { date: string }; message: string };
  repository: {
    full_name: string;
    html_url: string;
    description: string | null;
  };
};

type RepoHistory = {
  nameWithOwner: string;
  url: string;
  description: string | null;
  defaultBranchRef: {
    target: {
      history?: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<{
          oid: string;
          messageHeadline: string;
          url: string;
          authoredDate: string;
        }>;
      };
    };
  } | null;
};

type CommitRepos = {
  commitContributionsByRepository: Array<{
    repository: { nameWithOwner: string };
  }>;
};

const COMMIT_REPOS_QUERY = `
  query CommitRepos($login: String!, $year: DateTime!, $recent: DateTime!) {
    user(login: $login) {
      id
      year: contributionsCollection(from: $year) {
        commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
      }
      recent: contributionsCollection(from: $recent) {
        commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner } }
      }
    }
  }
`;

function commitHistoryQuery(count: number): string {
  const params = Array.from(
    { length: count },
    (_, i) => `$o${i}: String!, $n${i}: String!, $a${i}: String`
  ).join(", ");
  const repos = Array.from(
    { length: count },
    (_, i) => `r${i}: repository(owner: $o${i}, name: $n${i}) {
      nameWithOwner url description
      defaultBranchRef { target { ... on Commit {
        history(first: 100, since: $since, author: { id: $author }, after: $a${i}) {
          pageInfo { hasNextPage endCursor }
          nodes { oid messageHeadline url authoredDate }
        }
      } } }
    }`
  ).join("\n");
  return `query CommitHistory($since: GitTimestamp!, $author: ID!, ${params}) {\n${repos}\n}`;
}

/** GraphQL that tolerates per-repository errors (deleted or inaccessible repos resolve to null). */
async function graphqlData<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  fresh?: boolean
): Promise<T> {
  const response = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: fresh ? "no-cache" : "no-store",
  });
  if (response.status === 401) throw new GitHubAuthError();
  if (!response.ok) throw new Error("GitHub GraphQL unavailable");
  const json = (await response.json()) as { data?: T | null };
  if (!json.data) throw new Error("GitHub GraphQL error");
  return json.data;
}

/**
 * A year of the user's commits, newest first, read through GraphQL: the
 * repositories they committed to, then each one's default-branch history
 * filtered to their author id. This matches what commit search indexes but
 * spends no Search API quota; paging a year of commit search trips GitHub's
 * secondary (anti-scraping) limit, which then blocks every API for the user.
 */
async function fetchCommitTimeline(
  login: string,
  start: string,
  token: string,
  fresh?: boolean
): Promise<SearchResult<TimelineCommit>> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Day-aligned bounds keep the request bodies, and so the response cache, stable all day.
  const recent = new Date(today.getTime() - 30 * 86_400_000).toISOString();
  const { user } = await graphqlData<{
    user: { id: string; year: CommitRepos; recent: CommitRepos } | null;
  }>(
    COMMIT_REPOS_QUERY,
    { login, year: `${start}T00:00:00Z`, recent },
    token,
    fresh
  );
  if (!user) throw new Error("GitHub user not found");
  const names = new Set(
    [
      ...user.year.commitContributionsByRepository,
      ...user.recent.commitContributionsByRepository,
    ].map((entry) => entry.repository.nameWithOwner)
  );

  const items: TimelineCommit[] = [];
  let pending = [...names].map((name) => ({
    name,
    after: null as string | null,
  }));
  for (let round = 0; pending.length > 0 && round < HISTORY_ROUNDS; round++) {
    const next: typeof pending = [];
    for (let i = 0; i < pending.length; i += HISTORY_BATCH) {
      const batch = pending.slice(i, i + HISTORY_BATCH);
      const variables: Record<string, unknown> = {
        since: `${start}T00:00:00Z`,
        author: user.id,
      };
      batch.forEach((repo, j) => {
        const [owner, name] = repo.name.split("/");
        variables[`o${j}`] = owner;
        variables[`n${j}`] = name;
        variables[`a${j}`] = repo.after;
      });
      const data = await graphqlData<Record<string, RepoHistory | null>>(
        commitHistoryQuery(batch.length),
        variables,
        token,
        fresh
      );
      batch.forEach((pendingRepo, j) => {
        const repo = data[`r${j}`];
        const history = repo?.defaultBranchRef?.target.history;
        if (!repo || !history) return;
        for (const node of history.nodes)
          items.push({
            sha: node.oid,
            html_url: node.url,
            commit: {
              author: { date: node.authoredDate },
              message: node.messageHeadline,
            },
            repository: {
              full_name: repo.nameWithOwner,
              html_url: repo.url,
              description: repo.description,
            },
          });
        if (history.pageInfo.hasNextPage && history.pageInfo.endCursor)
          next.push({
            name: pendingRepo.name,
            after: history.pageInfo.endCursor,
          });
      });
    }
    pending = next;
  }
  items.sort(
    (a, b) =>
      Date.parse(b.commit.author.date) - Date.parse(a.commit.author.date)
  );
  return pending.length === 0
    ? { items, total: items.length, complete: true }
    : {
        items,
        total: items.length,
        complete: false,
        partialReason: "Commit history exceeds the per-request page budget",
      };
}

const timelines = new Map<
  string,
  { at: number; result: Promise<SearchResult<TimelineCommit>> }
>();
const TIMELINE_FRESH_MS = 5 * 60_000;
// A forced refresh reaches every widget within about a minute; they share one rebuild.
const TIMELINE_REFRESHED_MS = 60_000;

function sharedCommitTimeline(
  login: string,
  start: string,
  token: string,
  fresh?: boolean
): Promise<SearchResult<TimelineCommit>> {
  const key = `${token}:${login}:${start}`;
  const entry = timelines.get(key);
  if (
    entry &&
    Date.now() - entry.at < (fresh ? TIMELINE_REFRESHED_MS : TIMELINE_FRESH_MS)
  )
    return entry.result;
  for (const [k, v] of timelines)
    if (Date.now() - v.at >= TIMELINE_FRESH_MS) timelines.delete(k);
  const result = fetchCommitTimeline(login, start, token, fresh);
  timelines.set(key, { at: Date.now(), result });
  result.catch(() => {
    if (timelines.get(key)?.result === result) timelines.delete(key);
  });
  return result;
}

/** Test isolation. */
export function resetCommitTimelines() {
  timelines.clear();
}

/**
 * Commits authored by `login` on or after `since` (YYYY-MM-DD, UTC).
 *
 * Every window within the last year is derived from one shared timeline
 * instead of a search per window: the Search API allows only 30
 * requests/minute, and per-window queries multiplied one dashboard load into
 * ~100 searches.
 */
export async function collectAuthorCommits<T extends AuthorCommitItem>(
  login: string,
  since: string,
  token?: string,
  options: { fresh?: boolean } = {}
): Promise<SearchResult<T>> {
  const start = new Date(Date.now() - COMMIT_TIMELINE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const author = login.toLowerCase();
  if (since < start)
    return collectGitHubSearch<T>(
      "commits",
      `author:${author} author-date:>=${since}`,
      token,
      {
        fresh: options.fresh,
      }
    );

  const timeline = token
    ? ((await sharedCommitTimeline(
        author,
        start,
        token,
        options.fresh
      )) as unknown as SearchResult<T>)
    : await collectGitHubSearch<T>(
        "commits",
        `author:${author} author-date:>=${start}`,
        token,
        {
          timeoutMs: 25_000,
          fresh: options.fresh,
        }
      );
  const sinceMs = Date.parse(`${since}T00:00:00Z`);
  const items = timeline.items.filter(
    (item) => Date.parse(item.commit.author.date) >= sinceMs
  );
  const oldest = timeline.items.at(-1);
  // Newest-first: once the fetched tail is older than the window, the window is whole.
  const covered =
    timeline.complete ||
    (oldest !== undefined && Date.parse(oldest.commit.author.date) < sinceMs);
  return covered
    ? { items, total: items.length, complete: true }
    : {
        items,
        total: items.length,
        complete: false,
        partialReason: timeline.partialReason,
        ...(timeline.retryAfter ? { retryAfter: timeline.retryAfter } : {}),
      };
}

/** GitHub Search exposes at most 1,000 items. A bounded sample is explicitly labelled. */
export async function collectGitHubSearch<T>(
  path: "commits" | "issues",
  query: string,
  token?: string,
  options: {
    sort?: string;
    order?: string;
    timeoutMs?: number;
    fresh?: boolean;
  } = {}
): Promise<SearchResult<T>> {
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 10_000);
  const items: T[] = [];
  let total = 0;
  let incomplete = false;
  for (let page = 1; page <= 10; page++) {
    try {
      const params = new URLSearchParams({
        q: query,
        per_page: "100",
        page: String(page),
        sort: options.sort ?? (path === "commits" ? "author-date" : "updated"),
        order: options.order ?? "desc",
      });
      const response = await githubRequest(
        `https://api.github.com/search/${path}?${params}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: deadline,
          ...(options.fresh ? { cache: "no-cache" as const } : {}),
        }
      );
      if (!response.ok) {
        if (response.status === 401) throw new GitHubAuthError();
        throw new Error("GitHub search unavailable");
      }
      const data = (await response.json()) as {
        items: T[];
        total_count: number;
        incomplete_results?: boolean;
      };
      if (!Array.isArray(data.items) || !Number.isFinite(data.total_count))
        throw new Error("Invalid GitHub search response");
      total = data.total_count;
      incomplete ||= data.incomplete_results === true;
      items.push(...data.items);
      if (data.items.length < 100 || items.length >= total)
        return {
          items,
          total,
          complete: !incomplete && items.length >= total,
          ...(incomplete
            ? { partialReason: "GitHub search reported incomplete results" }
            : {}),
        };
    } catch (error) {
      if (items.length === 0 || error instanceof GitHubAuthError) throw error;
      return {
        items,
        total,
        complete: false,
        partialReason:
          error instanceof GitHubRateLimitError
            ? "GitHub rate limit"
            : deadline.aborted
              ? "Request deadline"
              : "GitHub search unavailable",
        ...(error instanceof GitHubRateLimitError
          ? { retryAfter: error.retryAfter ?? 60 }
          : {}),
      };
    }
  }
  return {
    items,
    total,
    complete: false,
    partialReason: "GitHub Search limits results to 1,000 items",
  };
}
