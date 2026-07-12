/**
 * Tests for GitHub credential failure detection in the metrics routes that were
 * missing auth-error handling.
 *
 * Covers for each route:
 *   - session.error === "TokenRevoked" returns { error: "token_expired" } (401)
 *   - GitHub API returning 401 propagates as { error: "token_expired" } (401)
 *   - Non-auth GitHub failures (403 rate limit, 500) return generic 502
 */

import "./setup";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── shared mock setup ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: vi.fn().mockReturnValue(false),
  METRICS_CACHE_TTL_SECONDS: {
    contributions: 300,
    repos: 300,
    prs: 300,
    activity: 300,
    issues: 300,
    languages: 300,
    streak: 300,
    discussions: 300,
    "pr-review-time": 300,
    "productive-hours": 300,
    "inactive-repos": 300,
  },
  metricsCacheKey: vi.fn().mockReturnValue("test-cache-key"),
  withMetricsCache: vi.fn().mockImplementation((_opts: unknown, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/github-accounts", () => ({
  getAccountToken: vi.fn().mockResolvedValue(null),
  getAllAccounts: vi.fn().mockResolvedValue([]),
  mergeMetrics: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: null,
}));

import { getServerSession } from "next-auth";
const mockGetServerSession = vi.mocked(getServerSession);

function revokedSession() {
  return {
    accessToken: "old-token",
    githubLogin: "testuser",
    githubId: "123",
    error: "TokenRevoked",
  } as any;
}

function validSession() {
  return {
    accessToken: "valid-token",
    githubLogin: "testuser",
    githubId: "123",
  } as any;
}

function mockGitHub401() {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 401,
    headers: { get: () => null },
    json: async () => ({ message: "Bad credentials" }),
  });
}

function mockGitHub403RateLimit() {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 403,
    headers: { get: (k: string) => (k === "X-RateLimit-Remaining" ? "0" : null) },
    json: async () => ({ message: "API rate limit exceeded" }),
  });
}

// ─── /api/metrics/discussions ─────────────────────────────────────────────────

describe("GET /api/metrics/discussions — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce(revokedSession());

    const { GET } = await import("@/app/api/metrics/discussions/route");
    const req = new NextRequest("http://localhost/api/metrics/discussions");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns token_expired when GitHub GraphQL returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockGitHub401();

    const { GET } = await import("@/app/api/metrics/discussions/route");
    const req = new NextRequest("http://localhost/api/metrics/discussions");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns 502 for non-auth GitHub failures", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({}),
    });

    const { GET } = await import("@/app/api/metrics/discussions/route");
    const req = new NextRequest("http://localhost/api/metrics/discussions");
    const res = await GET(req);

    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toBe("token_expired");
  });
});

// ─── /api/metrics/pr-review-time ─────────────────────────────────────────────

describe("GET /api/metrics/pr-review-time — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce(revokedSession());

    const { GET } = await import("@/app/api/metrics/pr-review-time/route");
    const req = new NextRequest("http://localhost/api/metrics/pr-review-time");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns token_expired when GitHub search API returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockGitHub401();

    const { GET } = await import("@/app/api/metrics/pr-review-time/route");
    const req = new NextRequest("http://localhost/api/metrics/pr-review-time");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns 502 for non-auth GitHub failures (rate limit 403)", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockGitHub403RateLimit();

    const { GET } = await import("@/app/api/metrics/pr-review-time/route");
    const req = new NextRequest("http://localhost/api/metrics/pr-review-time");
    const res = await GET(req);

    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toBe("token_expired");
  });
});

// ─── /api/metrics/productive-hours ───────────────────────────────────────────

describe("GET /api/metrics/productive-hours — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce(revokedSession());

    const { GET } = await import("@/app/api/metrics/productive-hours/route");
    const req = new NextRequest("http://localhost/api/metrics/productive-hours");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns token_expired when GitHub search API returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockGitHub401();

    const { GET } = await import("@/app/api/metrics/productive-hours/route");
    const req = new NextRequest("http://localhost/api/metrics/productive-hours");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns 502 for non-auth GitHub failures (rate limit 403 with no prior data)", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({ message: "API rate limit exceeded" }),
    });

    const { GET } = await import("@/app/api/metrics/productive-hours/route");
    const req = new NextRequest("http://localhost/api/metrics/productive-hours");
    const res = await GET(req);

    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toBe("token_expired");
  });
});

// ─── /api/metrics/inactive-repos ─────────────────────────────────────────────

describe("GET /api/metrics/inactive-repos — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce(revokedSession());

    const { GET } = await import("@/app/api/metrics/inactive-repos/route");
    const req = new NextRequest("http://localhost/api/metrics/inactive-repos");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns token_expired when GitHub API returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockGitHub401();

    const { GET } = await import("@/app/api/metrics/inactive-repos/route");
    const req = new NextRequest("http://localhost/api/metrics/inactive-repos");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns 502 for non-auth GitHub failures (422 malformed query)", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({ message: "Validation failed" }),
    });

    const { GET } = await import("@/app/api/metrics/inactive-repos/route");
    const req = new NextRequest("http://localhost/api/metrics/inactive-repos");
    const res = await GET(req);

    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toBe("token_expired");
  });
});

// ─── /api/metrics/weekly-summary ─────────────────────────────────────────────

describe("GET /api/metrics/weekly-summary — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce(revokedSession());

    const { GET } = await import("@/app/api/metrics/weekly-summary/route");
    const req = new NextRequest("http://localhost/api/metrics/weekly-summary");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns token_expired when GitHub commits search returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());
    mockGitHub401();

    const { GET } = await import("@/app/api/metrics/weekly-summary/route");
    const req = new NextRequest("http://localhost/api/metrics/weekly-summary");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("token_expired");
  });

  it("returns 502 when PR search fails with a non-auth error after commits succeed", async () => {
    mockGetServerSession.mockResolvedValueOnce(validSession());

    // First call (commits search) succeeds with empty results
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ items: [] }),
      })
      // Second call (PR search) fails with a non-auth 500
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: async () => ({}),
      });

    const { GET } = await import("@/app/api/metrics/weekly-summary/route");
    const req = new NextRequest("http://localhost/api/metrics/weekly-summary");
    const res = await GET(req);

    expect(res.status).toBe(502);
    expect((await res.json()).error).not.toBe("token_expired");
  });
});
