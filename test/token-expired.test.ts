/**
 * Focused tests for GitHub token-expiry / revocation handling.
 *
 * Covers:
 *  - GitHubAuthError thrown when GitHub returns 401
 *  - githubAuthErrorResponse() shape
 *  - Metrics routes return { error: "token_expired" } on GitHubAuthError
 *  - Metrics routes return { error: "token_expired" } when session.error === "TokenRevoked"
 *  - Non-auth GitHub failures still return the generic 502 error
 */

import "./setup";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared mock setup ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

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
  isSupabaseAdminAvailable: false,
}));

import { getServerSession } from "next-auth";

const mockGetServerSession = vi.mocked(getServerSession);

// ─── GitHubAuthError and githubAuthErrorResponse ──────────────────────────────

import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";

describe("GitHubAuthError", () => {
  it("has name GitHubAuthError and status 401", () => {
    const err = new GitHubAuthError();
    expect(err.name).toBe("GitHubAuthError");
    expect(err.status).toBe(401);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("githubAuthErrorResponse", () => {
  it("returns a 401 response with token_expired error body", async () => {
    const res = githubAuthErrorResponse();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "token_expired" });
  });
});

// ─── Metrics routes ───────────────────────────────────────────────────────────

describe("/api/metrics/repos — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "old-token",
      githubLogin: "testuser",
      githubId: "123",
      error: "TokenRevoked",
    } as any);

    const { GET } = await import("@/app/api/metrics/repos/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns token_expired when GitHub API returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "revoked-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/repos/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns 502 for non-auth GitHub failures (not a 401)", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "valid-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/repos/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("GitHub API error");
  });
});

describe("/api/metrics/issues — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "old-token",
      githubLogin: "testuser",
      githubId: "123",
      error: "TokenRevoked",
    } as any);

    const { GET } = await import("@/app/api/metrics/issues/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns token_expired when GitHub search API returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "revoked-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/issues/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });
});

describe("/api/metrics/discussions — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "old-token",
      githubLogin: "testuser",
      githubId: "123",
      error: "TokenRevoked",
    } as any);

    const { GET } = await import("@/app/api/metrics/discussions/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns token_expired when GitHub GraphQL returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "revoked-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/discussions/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns 502 for non-auth GitHub failures", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "valid-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/discussions/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toBe("token_expired");
  });
});

describe("/api/metrics/pinned-repos — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "old-token",
      error: "TokenRevoked",
    } as any);

    const { GET } = await import("@/app/api/metrics/pinned-repos/route");
    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns token_expired when GitHub GraphQL returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "revoked-token",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/pinned-repos/route");
    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });
});

describe("/api/metrics/pr-breakdown — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "old-token",
      githubLogin: "testuser",
      githubId: "123",
      error: "TokenRevoked",
    } as any);

    const { GET } = await import("@/app/api/metrics/pr-breakdown/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns token_expired when GitHub search API returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "revoked-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/pr-breakdown/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns 502 for non-auth GitHub failures", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "valid-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/pr-breakdown/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toBe("token_expired");
  });
});

describe("/api/metrics/weekly-summary — token expiry handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("returns token_expired when session.error is TokenRevoked", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "old-token",
      githubLogin: "testuser",
      githubId: "123",
      error: "TokenRevoked",
    } as any);

    const { GET } = await import("@/app/api/metrics/weekly-summary/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });

  it("returns token_expired when GitHub commit search returns 401", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      accessToken: "revoked-token",
      githubLogin: "testuser",
      githubId: "123",
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
    });

    const { GET } = await import("@/app/api/metrics/weekly-summary/route");
    const req = { nextUrl: { searchParams: { get: () => null } } } as any;
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("token_expired");
  });
});
