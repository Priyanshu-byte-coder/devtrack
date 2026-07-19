/**
 * Typed GitHub API fetch helper.
 * Centralises Authorization headers, Accept header, ok-check,
 * and rate-limit error handling so metric routes don't
 * repeat the same ~10-line pattern.
 */

import { GITHUB_API } from "@/lib/github";

export { GITHUB_API };

export class GitHubRateLimitError extends Error {
  constructor(
    public resetAt: Date | null,
    public retryAfter: number | null = null,
  ) {
    super("GitHub API rate limit exceeded");
    this.name = "GitHubRateLimitError";
  }
}

export class GitHubApiError extends Error {
  constructor(public status: number) {
    super(`GitHub API error: ${status}`);
    this.name = "GitHubApiError";
  }
}

/**
 * Thrown when the GitHub API responds with 401, indicating the stored OAuth
 * token has been revoked or has expired.
 */
export class GitHubAuthError extends Error {
  readonly status = 401;
  constructor() {
    super("GitHub token revoked or expired");
    this.name = "GitHubAuthError";
  }
}

/**
 * Returns a standardised 401 JSON response for metric routes that detect a
 * revoked token.  Client-side code checks for the `token_expired` error code
 * to show a reconnect prompt instead of a generic error state.
 */
export function githubAuthErrorResponse(): Response {
  return Response.json(
    { error: "token_expired" },
    { status: 401 }
  );
}

function extractRateLimitInfo(headers: Headers): {
  resetAt: Date | null;
  retryAfter: number | null;
  remaining: number | null;
} {
  const resetHeader = headers.get("X-RateLimit-Reset");
  const retryAfterHeader = headers.get("Retry-After");
  const remainingHeader = headers.get("X-RateLimit-Remaining");

  return {
    resetAt: resetHeader ? new Date(Number(resetHeader) * 1000) : null,
    retryAfter: retryAfterHeader !== null ? Number(retryAfterHeader) : null,
    remaining: remainingHeader !== null ? Number(remainingHeader) : null,
  };
}

function isSecondaryRateLimitBody(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const message = ((body as { message?: string }).message ?? "").toLowerCase();
  return (
    message.includes("secondary rate limit") ||
    message.includes("rate limit exceeded") ||
    message.includes("exceeded a secondary")
  );
}

async function buildGitHubError(
  res: Response,
): Promise<GitHubRateLimitError | GitHubApiError> {
  const { resetAt, retryAfter, remaining } = extractRateLimitInfo(res.headers);

  // 429: always a rate limit
  if (res.status === 429) {
    return new GitHubRateLimitError(resetAt, retryAfter);
  }

  if (res.status === 403) {
    // Primary rate limit: quota exhausted
    if (remaining === 0) {
      return new GitHubRateLimitError(resetAt, retryAfter);
    }

    // Secondary rate limit: Retry-After header signals required backoff
    if (retryAfter !== null) {
      return new GitHubRateLimitError(resetAt, retryAfter);
    }

    // Secondary rate limit: body message indicates rate limiting
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Body not JSON or stream already consumed
    }
    if (isSecondaryRateLimitBody(body)) {
      return new GitHubRateLimitError(resetAt, retryAfter);
    }

    // Authorization failure: invalid token, insufficient scope, permissions
    return new GitHubApiError(res.status);
  }

  return new GitHubApiError(res.status);
}

/**
 * Fetch a GitHub API endpoint with standard headers.
 * Throws GitHubRateLimitError when response headers or body indicate actual rate limiting:
 * - 429 responses
 * - 403 with X-RateLimit-Remaining: 0 (primary rate limit)
 * - 403 with Retry-After header (secondary rate limit)
 * - 403 with rate-limit message in response body (secondary rate limit)
 * Authorization failures (invalid token, insufficient scope, permissions) throw GitHubApiError.
 */
export async function githubFetch<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
    cache: (options.cache as RequestCache) ?? "no-store",
  });

  if (!res.ok) {
    throw await buildGitHubError(res);
  }

  return res.json() as Promise<T>;
}

/**
 * POST to GitHub GraphQL API.
 */
export async function githubGraphQL<T>(
  query: string,
  token: string,
  variables?: Record<string, unknown>
): Promise<T> {

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

    // Retry on transient server errors (502/503) before error classification.
    if ((res.status === 502 || res.status === 503) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }

    if (!res.ok) {
      throw await buildGitHubError(res);
    }

    const json = await res.json();

    if (json.errors?.length) {
      const msg = json.errors.map((e: { message: string }) => e.message).join("; ");
      throw new Error(`GitHub GraphQL error: ${msg}`);
    }

    return json.data as T;
  }

  throw new GitHubApiError(502);
}
