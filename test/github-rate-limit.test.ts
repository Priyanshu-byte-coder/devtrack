import { describe, expect, it } from "vitest";
import {
  getGitHubRateLimitDetails,
  throwIfGitHubRateLimited,
  githubRateLimitResponse,
  GitHubRateLimitError,
} from "../src/lib/github-rate-limit";

function makeResponse(status: number, headers: Record<string, string | null>): Response {
  return new Response(null, {
    status,
    headers: new Headers(
      Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k, v ?? ""])
      ) as Record<string, string>
    ),
  });
}

describe("getGitHubRateLimitDetails", () => {
  it("returns null for 200 OK", () => {
    const res = makeResponse(200, {});
    expect(getGitHubRateLimitDetails(res)).toBeNull();
  });

  it("returns null for 403 with remaining > 0", () => {
    const res = makeResponse(403, { "x-ratelimit-remaining": "100" });
    expect(getGitHubRateLimitDetails(res)).toBeNull();
  });

  it("returns null for 429 with remaining > 0", () => {
    const res = makeResponse(429, { "x-ratelimit-remaining": "5" });
    expect(getGitHubRateLimitDetails(res)).toBeNull();
  });

  it("returns null for 403 when remaining header is missing", () => {
    const res = makeResponse(403, { "x-ratelimit-reset": "1730000000" });
    expect(getGitHubRateLimitDetails(res)).toBeNull();
  });

  it("returns rate limit details for 403 with remaining=0 and valid reset", () => {
    const resetEpoch = 1730000000;
    const res = makeResponse(403, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(resetEpoch),
    });
    const details = getGitHubRateLimitDetails(res);
    expect(details).not.toBeNull();
    expect(details!.code).toBe("GITHUB_RATE_LIMITED");
    expect(details!.resetAt).not.toBeNull();
    expect(details!.resetAtEpoch).toBe(resetEpoch);
  });

  it("returns rate limit details for 429 with remaining=0", () => {
    const resetEpoch = 1740000000;
    const res = makeResponse(429, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(resetEpoch),
    });
    const details = getGitHubRateLimitDetails(res);
    expect(details).not.toBeNull();
    expect(details!.code).toBe("GITHUB_RATE_LIMITED");
  });

  it("handles missing reset header gracefully", () => {
    const res = makeResponse(403, { "x-ratelimit-remaining": "0" });
    const details = getGitHubRateLimitDetails(res);
    expect(details).not.toBeNull();
    expect(details!.resetAt).toBeNull();
    expect(details!.resetAtEpoch).toBeNull();
    expect(details!.message).toContain("Please try again later");
  });

  it("handles NaN reset header gracefully", () => {
    const res = makeResponse(403, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "not-a-number",
    });
    const details = getGitHubRateLimitDetails(res);
    expect(details).not.toBeNull();
    expect(details!.resetAt).toBeNull();
    expect(details!.resetAtEpoch).toBeNull();
  });

  it("returns null for 200 even when remaining=0 header is present", () => {
    const res = makeResponse(200, { "x-ratelimit-remaining": "0" });
    expect(getGitHubRateLimitDetails(res)).toBeNull();
  });
});

describe("throwIfGitHubRateLimited", () => {
  it("does not throw for a non-rate-limited response", () => {
    const res = makeResponse(200, {});
    expect(() => throwIfGitHubRateLimited(res)).not.toThrow();
  });

  it("throws GitHubRateLimitError for 403 with remaining=0", () => {
    const res = makeResponse(403, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1730000000",
    });
    expect(() => throwIfGitHubRateLimited(res)).toThrow(GitHubRateLimitError);
  });

  it("throws GitHubRateLimitError for 429 with remaining=0", () => {
    const res = makeResponse(429, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1730000000",
    });
    expect(() => throwIfGitHubRateLimited(res)).toThrow(GitHubRateLimitError);
  });

  it("includes correct details on thrown error", () => {
    const res = makeResponse(403, {
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1730000000",
    });
    try {
      throwIfGitHubRateLimited(res);
    } catch (e) {
      expect(e).toBeInstanceOf(GitHubRateLimitError);
      expect((e as GitHubRateLimitError).details.code).toBe("GITHUB_RATE_LIMITED");
      expect((e as GitHubRateLimitError).details.resetAtEpoch).toBe(1730000000);
    }
  });
});

describe("githubRateLimitResponse", () => {
  it("returns null for non-GitHubRateLimitError", () => {
    const err = new Error("something else");
    expect(githubRateLimitResponse(err)).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(githubRateLimitResponse(null)).toBeNull();
    expect(githubRateLimitResponse(undefined)).toBeNull();
  });

  it("returns a 429 Response with correct JSON body for GitHubRateLimitError", async () => {
    const resetEpoch = 1730000000;
    const resetAt = new Date(resetEpoch * 1000).toISOString();
    const error = new GitHubRateLimitError({
      code: "GITHUB_RATE_LIMITED",
      message: "Rate limit exceeded",
      resetAt,
      resetAtEpoch: resetEpoch,
    });

    const response = githubRateLimitResponse(error);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);

    const body = await response!.json();
    expect(body.error).toBe("GITHUB_RATE_LIMITED");
    expect(body.rateLimit.resetAt).toBe(resetAt);
    expect(body.rateLimit.resetAtEpoch).toBe(resetEpoch);
  });
});
