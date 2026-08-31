import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GitHubRateLimitError,
  GitHubApiError,
  githubFetch,
  githubGraphQL,
} from "@/lib/github-fetch";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── GitHubRateLimitError ────────────────────────────────────────────────────

describe("GitHubRateLimitError", () => {
  it("should have correct name and message", () => {
    const error = new GitHubRateLimitError(null);
    expect(error.name).toBe("GitHubRateLimitError");
    expect(error.message).toBe("GitHub API rate limit exceeded");
  });

  it("should store resetAt date when provided", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    const error = new GitHubRateLimitError(date);
    expect(error.resetAt).toEqual(date);
  });

  it("should store null resetAt when not provided", () => {
    const error = new GitHubRateLimitError(null);
    expect(error.resetAt).toBeNull();
  });

  it("should store retryAfter when provided", () => {
    const error = new GitHubRateLimitError(null, 60);
    expect(error.retryAfter).toBe(60);
  });

  it("should default retryAfter to null", () => {
    const error = new GitHubRateLimitError(null);
    expect(error.retryAfter).toBeNull();
  });

  it("should be instance of Error", () => {
    const error = new GitHubRateLimitError(null);
    expect(error).toBeInstanceOf(Error);
  });
});

// ─── GitHubApiError ──────────────────────────────────────────────────────────

describe("GitHubApiError", () => {
  it("should have correct name and message", () => {
    const error = new GitHubApiError(404);
    expect(error.name).toBe("GitHubApiError");
    expect(error.message).toBe("GitHub API error: 404");
  });

  it("should store status code", () => {
    const error = new GitHubApiError(500);
    expect(error.status).toBe(500);
  });

  it("should be instance of Error", () => {
    const error = new GitHubApiError(404);
    expect(error).toBeInstanceOf(Error);
  });
});

// ─── githubFetch ─────────────────────────────────────────────────────────────

describe("githubFetch", () => {
  it("should return parsed JSON on success", async () => {
    const mockData = { login: "testuser", id: 123 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
      headers: { get: () => null },
    });

    const result = await githubFetch(
      "https://api.github.com/users/testuser",
      "test-token"
    );
    expect(result).toEqual(mockData);
  });

  // ── 429 ─────────────────────────────────────────────────────────────────────

  it("should throw GitHubRateLimitError on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("should parse resetAt from X-RateLimit-Reset header on 429", async () => {
    const resetTimestamp = 1735689600;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (key: string) =>
          key === "X-RateLimit-Reset" ? String(resetTimestamp) : null,
      },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toMatchObject({
      resetAt: new Date(resetTimestamp * 1000),
    });
  });

  it("should parse retryAfter from Retry-After header on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (key: string) =>
          key === "Retry-After" ? "60" : null,
      },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toMatchObject({
      retryAfter: 60,
    });
  });

  // ── 403 — rate limit ─────────────────────────────────────────────────────────

  it("should throw GitHubRateLimitError on 403 with X-RateLimit-Remaining: 0", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) =>
          key === "X-RateLimit-Remaining" ? "0" : null,
      },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("should throw GitHubRateLimitError on 403 with Retry-After header (secondary rate limit)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) =>
          key === "Retry-After" ? "120" : null,
      },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("should parse retryAfter from Retry-After header on 403 secondary rate limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) =>
          key === "Retry-After" ? "120" : null,
      },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toMatchObject({
      retryAfter: 120,
    });
  });

  it("should throw GitHubRateLimitError on 403 with secondary rate limit body message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        message: "You have exceeded a secondary rate limit. Please wait a few minutes before you try again.",
      }),
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("should throw GitHubRateLimitError on 403 with 'rate limit exceeded' body message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        message: "API rate limit exceeded for user ID 123",
      }),
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("should include resetAt from X-RateLimit-Reset on 403 with remaining=0", async () => {
    const resetTimestamp = 1735689600;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) => {
          if (key === "X-RateLimit-Remaining") return "0";
          if (key === "X-RateLimit-Reset") return String(resetTimestamp);
          return null;
        },
      },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toMatchObject({
      resetAt: new Date(resetTimestamp * 1000),
    });
  });

  // ── 403 — authorization failure (must NOT be classified as rate limit) ──────

  it("should throw GitHubApiError on 403 with remaining > 0 (permission failure)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) =>
          key === "X-RateLimit-Remaining" ? "4999" : null,
      },
      json: async () => ({
        message: "Must have push access to create or delete labels.",
      }),
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });

  it("should throw GitHubApiError on 403 with invalid credentials message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        message: "Bad credentials",
      }),
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });

  it("should throw GitHubApiError on 403 with insufficient scope message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        message: "Token does not have the required scope.",
      }),
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });

  it("should throw GitHubApiError on 403 without any rate-limit indicators", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        message: "Resource not accessible by personal access token",
      }),
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });

  it("should throw GitHubApiError on 403 when body is not JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => { throw new SyntaxError("Unexpected token"); },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });

  // ── other non-ok statuses ────────────────────────────────────────────────────

  it("should throw GitHubApiError on other non-ok status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
    });

    await expect(
      githubFetch("https://api.github.com/test", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });

  it("should set resetAt to null when X-RateLimit-Reset header is missing on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    try {
      await githubFetch("https://api.github.com/test", "test-token");
    } catch (err) {
      expect(err).toBeInstanceOf(GitHubRateLimitError);
      expect((err as GitHubRateLimitError).resetAt).toBeNull();
    }
  });

  // ── request headers ──────────────────────────────────────────────────────────

  it("should send correct Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      headers: { get: () => null },
    });

    await githubFetch("https://api.github.com/test", "my-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-token",
        }),
      })
    );
  });
});

// ─── githubGraphQL ───────────────────────────────────────────────────────────

describe("githubGraphQL", () => {
  it("should return data on success", async () => {
    const mockData = { viewer: { login: "testuser" } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockData }),
      headers: { get: () => null },
    });

    const result = await githubGraphQL("{ viewer { login } }", "test-token");
    expect(result).toEqual(mockData);
  });

  // ── 429 ─────────────────────────────────────────────────────────────────────

  it("should throw GitHubRateLimitError on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    await expect(
      githubGraphQL("{ viewer { login } }", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  // ── 403 — rate limit ─────────────────────────────────────────────────────────

  it("should throw GitHubRateLimitError on 403 with X-RateLimit-Remaining: 0", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) =>
          key === "X-RateLimit-Remaining" ? "0" : null,
      },
    });

    await expect(
      githubGraphQL("{ viewer { login } }", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("should throw GitHubRateLimitError on 403 with Retry-After header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) =>
          key === "Retry-After" ? "60" : null,
      },
    });

    await expect(
      githubGraphQL("{ viewer { login } }", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("should throw GitHubRateLimitError on 403 with secondary rate limit body message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        message: "You have exceeded a secondary rate limit.",
      }),
    });

    await expect(
      githubGraphQL("{ viewer { login } }", "test-token")
    ).rejects.toThrow(GitHubRateLimitError);
  });

  // ── 403 — authorization failure ──────────────────────────────────────────────

  it("should throw GitHubApiError on 403 without rate-limit indicators (permission failure)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({
        message: "Your token has not been granted the required scopes.",
      }),
    });

    await expect(
      githubGraphQL("{ viewer { login } }", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });

  // ── other non-ok statuses ────────────────────────────────────────────────────

  it("should throw GitHubApiError on other non-ok status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => null },
    });

    await expect(
      githubGraphQL("{ viewer { login } }", "test-token")
    ).rejects.toThrow(GitHubApiError);
  });
});
