import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/sponsors/sync/route";

// --- hoisted mocks ---

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

vi.stubGlobal("fetch", mocks.fetch);

// --- helpers ---

const VALID_SECRET = "test-cron-secret";

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/sponsors/sync", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function authedRequest(): Request {
  return makeRequest(`Bearer ${VALID_SECRET}`);
}

function graphqlResponse(sponsors: Array<{ login: string }>) {
  return {
    ok: true,
    json: async () => ({
      data: {
        user: {
          sponsorshipsAsMaintainer: {
            nodes: sponsors.map((s) => ({
              sponsorEntity: { login: s.login },
            })),
          },
        },
      },
    }),
  };
}

function setupSupabase(currentSponsorLogins: string[]) {
  const updateInChain = vi.fn().mockResolvedValue({ error: null });
  const updateChain = vi.fn().mockReturnValue({ in: updateInChain });

  const selectEqChain = vi.fn().mockResolvedValue({
    data: currentSponsorLogins.map((login) => ({ github_login: login })),
    error: null,
  });
  const selectChain = vi.fn().mockReturnValue({ eq: selectEqChain });

  mocks.supabaseFrom.mockReturnValue({
    select: selectChain,
    update: updateChain,
  });

  return { updateChain, updateInChain };
}

// --- tests ---

describe("GET /api/sponsors/sync - authentication (#1657)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("CRON_SECRET", VALID_SECRET);
    vi.stubEnv("GITHUB_TOKEN", "gh-token");
  });

  // -- authentication --

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(authedRequest());
    expect(res.status).toBe(500);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is wrong", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // -- development environment - no bypass (#1657) --

  it("returns 401 in development when the header is missing - no NODE_ENV bypass (#1657)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 in development when the header is wrong - no NODE_ENV bypass (#1657)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("allows a correct secret in development (#1657)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { sponsorshipsAsMaintainer: { nodes: [] } } } }),
    });
    setupSupabase([]);
    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
  });

  // -- GitHub API errors --

  it("returns 500 when GITHUB_TOKEN is not configured", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const res = await GET(authedRequest());
    expect(res.status).toBe(500);
  });

  it("returns 502 when the GitHub GraphQL request fails", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 500 });
    const res = await GET(authedRequest());
    expect(res.status).toBe(502);
  });

  it("returns 502 when the GraphQL response contains errors", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: "Forbidden" }] }),
    });
    const res = await GET(authedRequest());
    expect(res.status).toBe(502);
  });

  it("returns 502 when GraphQL data.user is null", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: null } }),
    });
    const res = await GET(authedRequest());
    expect(res.status).toBe(502);
  });

  // -- sync behavior --

  it("returns 200 with empty sponsor list when no sponsors exist", async () => {
    mocks.fetch.mockResolvedValue(graphqlResponse([]));
    setupSupabase([]);

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sponsorCount).toBe(0);
  });

  it("returns sponsorCount and sponsors in the response", async () => {
    mocks.fetch.mockResolvedValue(
      graphqlResponse([{ login: "alice" }, { login: "bob" }])
    );
    setupSupabase([]);

    const res = await GET(authedRequest());
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sponsorCount).toBe(2);
    expect(body.sponsors).toEqual(expect.arrayContaining(["alice", "bob"]));
  });
});