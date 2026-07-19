/**
 * Tests for GitHub Organization support (issue #1039).
 *
 * Coverage:
 *  - github-orgs.ts utility functions
 *  - GET /api/user/github-orgs
 *  - PATCH /api/user/github-orgs
 *  - Contributions route org: prefix handling
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  fetchFn: vi.fn(),
  getAccountToken: vi.fn(),
  getAllAccounts: vi.fn(),
  mergeMetrics: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: mocks.resolveAppUser,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));
vi.mock("@/lib/github-accounts", () => ({
  getAccountToken: mocks.getAccountToken,
  getAllAccounts: mocks.getAllAccounts,
  mergeMetrics: mocks.mergeMetrics,
}));
// Intercept global fetch for GitHub API calls
vi.stubGlobal("fetch", mocks.fetchFn);

// ─── helpers ──────────────────────────────────────────────────────────────────

const SESSION = {
  githubId: "gh-100",
  githubLogin: "alice",
  accessToken: "tok-alice",
};
const USER = { id: "user-uuid-100" };

function makeRequest(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const SAMPLE_ORG = {
  id: 12345,
  login: "my-company",
  avatar_url: "https://avatars.githubusercontent.com/o/12345",
  description: "My Company",
};

// ─── github-orgs.ts utilities ─────────────────────────────────────────────────

describe("fetchUserOrgs", () => {
  it("returns orgs on a successful GitHub API response", async () => {
    mocks.fetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => [SAMPLE_ORG],
    });

    const { fetchUserOrgs } = await import("../src/lib/github-orgs");
    const result = await fetchUserOrgs("tok");
    expect(result).toHaveLength(1);
    expect(result[0].login).toBe("my-company");
  });

  it("returns [] when GitHub returns 403 (missing read:org scope)", async () => {
    mocks.fetchFn.mockResolvedValueOnce({ ok: false, status: 403 });
    const { fetchUserOrgs } = await import("../src/lib/github-orgs");
    const result = await fetchUserOrgs("tok");
    expect(result).toEqual([]);
  });

  it("returns [] when the GitHub request throws a network error", async () => {
    mocks.fetchFn.mockRejectedValueOnce(new Error("network failure"));
    const { fetchUserOrgs } = await import("../src/lib/github-orgs");
    const result = await fetchUserOrgs("tok");
    expect(result).toEqual([]);
  });

  it("returns [] when GitHub returns an empty array (no orgs)", async () => {
    mocks.fetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const { fetchUserOrgs } = await import("../src/lib/github-orgs");
    const result = await fetchUserOrgs("tok");
    expect(result).toEqual([]);
  });
});

describe("orgSearchSegment", () => {
  it("returns ' org:{login}' when orgLogin is provided", async () => {
    const { orgSearchSegment } = await import("../src/lib/github-orgs");
    expect(orgSearchSegment("acme")).toBe(" org:acme");
  });

  it("returns '' for null orgLogin", async () => {
    const { orgSearchSegment } = await import("../src/lib/github-orgs");
    expect(orgSearchSegment(null)).toBe("");
  });

  it("returns '' for undefined orgLogin", async () => {
    const { orgSearchSegment } = await import("../src/lib/github-orgs");
    expect(orgSearchSegment(undefined)).toBe("");
  });

  it("returns '' for empty string orgLogin", async () => {
    const { orgSearchSegment } = await import("../src/lib/github-orgs");
    expect(orgSearchSegment("")).toBe("");
  });
});

// ─── GET /api/user/github-orgs ─────────────────────────────────────────────────

describe("GET /api/user/github-orgs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(SESSION);
    mocks.resolveAppUser.mockResolvedValue(USER);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/user/github-orgs/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns orgs merged with stored preferences", async () => {
    // GitHub API returns one org
    mocks.fetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => [SAMPLE_ORG],
    });

    // Supabase upsert
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    // Supabase select (stored prefs)
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          org_id: "12345",
          org_login: "my-company",
          avatar_url: "https://avatars.githubusercontent.com/o/12345",
          include_in_metrics: true,
        },
      ],
      error: null,
    });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });

    let callCount = 0;
    mocks.supabaseFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // upsert call
        return { upsert: upsertMock };
      }
      // select call
      return { select: vi.fn().mockReturnValue({ eq: eqMock }) };
    });

    const { GET } = await import("@/app/api/user/github-orgs/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { orgs: unknown[]; hasReadOrgScope: boolean };
    expect(body.orgs).toHaveLength(1);
    expect(body.hasReadOrgScope).toBe(true);
  });

  it("returns empty orgs when user has no organizations", async () => {
    mocks.fetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqMock }),
    });

    const { GET } = await import("@/app/api/user/github-orgs/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { orgs: unknown[] };
    expect(body.orgs).toHaveLength(0);
  });

  it("returns 500 when the Supabase select fails", async () => {
    mocks.fetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db error" },
    });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqMock }),
    });

    const { GET } = await import("@/app/api/user/github-orgs/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ─── PATCH /api/user/github-orgs ──────────────────────────────────────────────

describe("PATCH /api/user/github-orgs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(SESSION);
    mocks.resolveAppUser.mockResolvedValue(USER);
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/user/github-orgs/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/user/github-orgs", {
        orgId: "12345",
        includeInMetrics: false,
      })
    );
    expect(res.status).toBe(401);
  });

  it("updates include_in_metrics and returns ok:true", async () => {
    const eqOrgMock = vi.fn().mockResolvedValue({ error: null });
    const eqUserMock = vi.fn().mockReturnValue({ eq: eqOrgMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqUserMock });
    mocks.supabaseFrom.mockReturnValue({ update: updateMock });

    const { PATCH } = await import("@/app/api/user/github-orgs/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/user/github-orgs", {
        orgId: "12345",
        includeInMetrics: false,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 400 when orgId is missing", async () => {
    const { PATCH } = await import("@/app/api/user/github-orgs/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/user/github-orgs", {
        includeInMetrics: true,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when includeInMetrics is not a boolean", async () => {
    const { PATCH } = await import("@/app/api/user/github-orgs/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/user/github-orgs", {
        orgId: "12345",
        includeInMetrics: "yes",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { PATCH } = await import("@/app/api/user/github-orgs/route");
    const req = new NextRequest("http://localhost/api/user/github-orgs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when the Supabase update fails", async () => {
    const eqOrgMock = vi.fn().mockResolvedValue({
      error: { message: "db error" },
    });
    const eqUserMock = vi.fn().mockReturnValue({ eq: eqOrgMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqUserMock });
    mocks.supabaseFrom.mockReturnValue({ update: updateMock });

    const { PATCH } = await import("@/app/api/user/github-orgs/route");
    const res = await PATCH(
      makeRequest("PATCH", "http://localhost/api/user/github-orgs", {
        orgId: "12345",
        includeInMetrics: true,
      })
    );
    expect(res.status).toBe(500);
  });
});

// ─── Contributions route — org: prefix ────────────────────────────────────────

describe("GET /api/metrics/contributions — org: accountId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(SESSION);
    mocks.resolveAppUser.mockResolvedValue(USER);
  });

  it("passes org filter in search query for org: accountId", async () => {
    // Stub the commit search request — first call is the GitHub Search API
    mocks.fetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_count: 0, items: [] }),
    });

    mocks.getAccountToken.mockResolvedValue("tok-alice");

    // Stub metrics cache (supabase) — supports infinite chain-mocking
    const cacheSingle = vi.fn().mockResolvedValue({ data: { github_login: "alice" }, error: null });
    const createChain = () => {
      const obj = {
        eq: () => obj,
        single: cacheSingle,
      };
      return obj;
    };
    mocks.supabaseFrom.mockReturnValue({ select: () => createChain() });

    const { GET } = await import("@/app/api/metrics/contributions/route");
    const req = makeRequest(
      "GET",
      "http://localhost/api/metrics/contributions?days=30&accountId=org:12345:acme-corp"
    );
    await GET(req);

    // The GitHub Search API must have been called with org:acme-corp in the query
    const calledUrl = (mocks.fetchFn.mock.calls[0]?.[0] as string) ?? "";
    expect(calledUrl).toContain("org%3Aacme-corp");
  });

  it("returns 400 for empty org login (org: with no name)", async () => {
    // Stub session / user
    const { GET } = await import("@/app/api/metrics/contributions/route");
    const req = makeRequest(
      "GET",
      "http://localhost/api/metrics/contributions?days=30&accountId=org:"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("does NOT include org filter when accountId is null (personal view)", async () => {
    mocks.fetchFn.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_count: 0, items: [] }),
    });
    const cacheSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const createChain = () => {
      const obj = {
        eq: () => obj,
        single: cacheSingle,
      };
      return obj;
    };
    mocks.supabaseFrom.mockReturnValue({ select: () => createChain() });

    const { GET } = await import("@/app/api/metrics/contributions/route");
    const req = makeRequest(
      "GET",
      "http://localhost/api/metrics/contributions?days=30"
    );
    await GET(req);

    const calledUrl = (mocks.fetchFn.mock.calls[0]?.[0] as string) ?? "";
    expect(calledUrl).not.toContain("org%3A");
  });
});
