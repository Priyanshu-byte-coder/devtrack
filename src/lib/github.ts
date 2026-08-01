import { throwIfGitHubRateLimited } from "@/lib/github-rate-limit";

// Re-export the canonical GitHubAuthError class from github-fetch so all
// callers share the same class reference and instanceof checks work correctly.
import { GitHubAuthError } from "@/lib/github-fetch";
export { GitHubAuthError };

export const GITHUB_API = "https://api.github.com";

/**
 * Fetch wrapper with AbortController-based timeout for GitHub API calls.
 * Prevents hanging requests under slow/stalled network conditions.
 */
async function githubFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches recent events for the authenticated user from the GitHub API.
 * @param token - The user's GitHub personal access token.
 * @returns A promise that resolves to an array of GitHub events.
 */
export async function fetchUserEvents(token: string): Promise<GitHubEvent[]> {
  const res = await githubFetch(`${GITHUB_API}/user/events?per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    if (res.status === 401) throw new GitHubAuthError();
    throwIfGitHubRateLimited(res);
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

interface FetchUserReposOptions {
  perPage?: number;
  maxPages?: number;
}

/**
 * Fetches all repositories (public, private, and internal) for the authenticated user.
 * @param token - The user's GitHub personal access token.
 * @param options - Pagination options like perPage and maxPages.
 * @returns A promise that resolves to an array of GitHub repositories.
 */
export async function fetchUserRepos(
  token: string,
  options: FetchUserReposOptions = {}
): Promise<GitHubRepo[]> {
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? 10;
  const repos: GitHubRepo[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await githubFetch(
      `${GITHUB_API}/user/repos?visibility=all&sort=pushed&direction=desc&per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!res.ok) {
      if (res.status === 401) throw new GitHubAuthError();
      throwIfGitHubRateLimited(res);
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const pageRepos = (await res.json()) as GitHubRepo[];
    repos.push(...pageRepos);

    if (pageRepos.length < perPage) {
      break;
    }
  }

  return repos;
}

export interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  visibility?: "public" | "private" | "internal";
  open_issues_count: number;
  stargazers_count: number;
  pushed_at: string | null;
  updated_at: string;
  created_at: string;
  language: string | null;
  archived?: boolean;
}

export interface GitHubCommitSearchItem {
  sha: string;
  commit: {
    author: { date: string };
    message: string;
  };
  repository: { full_name: string };
  html_url: string;
}

export interface CommitItem {
  sha: string;
  message: string;
  date: string;
  repo: string;
  url: string;
}

export interface GitHubIssueItem {
  state: string;
  created_at: string;
  closed_at: string | null;
  repository_url: string;
}

export interface IssuesMetrics {
  opened: number;
  closed: number;
  currentlyOpen: number;
  avgCloseTimeDays: number;
  trend: number;
  mostActiveRepo: string | null;
}

/**
 * Fetches issue metrics (opened, closed, etc.) for a user or organization over the last 30 days.
 * @param token - A GitHub personal access token.
 * @param githubLogin - The GitHub username to search for (defaults to "@me").
 * @param orgName - Optional organization name to filter issues.
 * @param excludedOrgs - Array of organizations to exclude from the search.
 * @returns A promise that resolves to calculated issue metrics.
 */
export async function fetchIssuesMetrics(
  token: string,
  githubLogin?: string,
  orgName?: string | null,
  excludedOrgs: string[] = []
): Promise<IssuesMetrics> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const authorQ = githubLogin ? githubLogin : "@me";
  let q = `type:issue+author:${authorQ}`;
  if (orgName) {
    q += `+org:${orgName}`;
  } else if (excludedOrgs.length > 0) {
    q += excludedOrgs.map((org) => `+-org:${org}`).join("");
  }

  const searchRes = await githubFetch(
    `https://api.github.com/search/issues?q=${q}+created:>=${since30d.toISOString().slice(0, 10)}&per_page=100`,
    { headers, cache: "no-store" }
  );

  if (!searchRes.ok) {
    if (searchRes.status === 401) throw new GitHubAuthError();
    throwIfGitHubRateLimited(searchRes);
    throw new Error(`GitHub API error: ${searchRes.status}`);
  }

  const searchData = (await searchRes.json()) as { items: GitHubIssueItem[] };
  const items = searchData.items;

  const opened = items.length;
  const closedItems = items.filter((i) => i.state === "closed" && i.closed_at);
  const closed = closedItems.length;
  const currentlyOpen = items.filter((i) => i.state === "open").length;

  const avgCloseTimeDays =
    closedItems.length > 0
      ? Math.round(
          closedItems.reduce((sum, i) => {
            return (
              sum +
              (new Date(i.closed_at!).getTime() -
                new Date(i.created_at).getTime())
            );
          }, 0) /
            closedItems.length /
            86400000
        )
      : 0;

  const thisMonthRes = await githubFetch(
    `https://api.github.com/search/issues?q=${q}+created:>=${thisMonthStart.toISOString().slice(0, 10)}&per_page=1`,
    { headers, cache: "no-store" }
  );

  const lastMonthRes = await githubFetch(
    `https://api.github.com/search/issues?q=${q}+created:${lastMonthStart.toISOString().slice(0, 10)}..${lastMonthEnd.toISOString().slice(0, 10)}&per_page=1`,
    { headers, cache: "no-store" }
  );

  if (!thisMonthRes.ok) {
    if (thisMonthRes.status === 401) throw new GitHubAuthError();
    throwIfGitHubRateLimited(thisMonthRes);
  }

  if (!lastMonthRes.ok) {
    if (lastMonthRes.status === 401) throw new GitHubAuthError();
    throwIfGitHubRateLimited(lastMonthRes);
  }

  const thisMonthCount = thisMonthRes.ok
    ? ((await thisMonthRes.json()) as { total_count: number }).total_count
    : 0;

  const lastMonthCount = lastMonthRes.ok
    ? ((await lastMonthRes.json()) as { total_count: number }).total_count
    : 0;

  const repoCounts: Record<string, number> = {};

  for (const item of items) {
    const repo = item.repository_url.split("/").pop() ?? "";
    repoCounts[repo] = (repoCounts[repo] ?? 0) + 1;
  }

  const mostActiveRepo =
    Object.keys(repoCounts).length > 0
      ? Object.entries(repoCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return {
    opened,
    closed,
    currentlyOpen,
    avgCloseTimeDays,
    trend: thisMonthCount - lastMonthCount,
    mostActiveRepo,
  };
}
