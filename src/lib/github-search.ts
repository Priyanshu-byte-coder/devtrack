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
/** GitHub Search exposes at most 1,000 items. A bounded sample is explicitly labelled. */
export async function collectGitHubSearch<T>(
  path: "commits" | "issues",
  query: string,
  token?: string,
  options: { sort?: string; order?: string; timeoutMs?: number } = {}
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
