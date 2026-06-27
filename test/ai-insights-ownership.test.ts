import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));
vi.mock("@/lib/ai-prompts", () => ({
  weeklyProductivityPrompt: vi.fn().mockReturnValue("prompt"),
}));
vi.mock("@/lib/ai-mentor", () => ({
  analyzePatterns: vi.fn().mockReturnValue([]),
  computeTrends: vi.fn().mockReturnValue({ direction: "up", percentage: 5 }),
}));

vi.stubGlobal("fetch", mocks.fetch);

// ─── helpers ────────────────────────────────────────────────────────────────

const GITHUB_ID = "12345678";

// Each test that exercises the request path uses a unique UUID so it gets its
// own rate-limit bucket inside the module-level Map. This prevents the 5-req
// per-hour cap from spilling across tests.
let testCounter = 0;
function freshUUID(): string {
  testCounter += 1;
  return `550e8400-e29b-41d4-a716-${String(testCounter).padStart(12, "0")}`;
}

function makeRequest(type = "weekly_summary"): Request {
  return new Request(`http://localhost/api/ai-insights?type=${type}`, {
    headers: { cookie: "next-auth.session-token=tok" },
  });
}

function setupSupabaseCacheMiss() {
  const upsertChain = vi.fn().mockResolvedValue({ error: null });

  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const limit       = vi.fn().mockReturnValue({ maybeSingle });
  const order       = vi.fn().mockReturnValue({ limit });
  const gte         = vi.fn().mockReturnValue({ order });
  const eqType      = vi.fn().mockReturnValue({ gte });
  const eqUserId    = vi.fn().mockReturnValue({ eq: eqType });
  const selectChain = vi.fn().mockReturnValue({ eq: eqUserId });

  mocks.supabaseFrom.mockReturnValue({
    select: selectChain,
    upsert: upsertChain,
  });

  return { upsertChain, selectChain, eqUserId };
}

function setupSupabaseCacheHit(content: object) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { content }, error: null });
  const limit       = vi.fn().mockReturnValue({ maybeSingle });
  const order       = vi.fn().mockReturnValue({ limit });
  const gte         = vi.fn().mockReturnValue({ order });
  const eqType      = vi.fn().mockReturnValue({ gte });
  const eqUserId    = vi.fn().mockReturnValue({ eq: eqType });
  const selectChain = vi.fn().mockReturnValue({ eq: eqUserId });

  mocks.supabaseFrom.mockReturnValue({
    select: selectChain,
    upsert: vi.fn(),
  });
}

function stubMetricsFetches() {
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => "{}",
    status: 200,
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("GET /api/ai-insights — ownership model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubMetricsFetches();

    mocks.getServerSession.mockResolvedValue({
      githubId: GITHUB_ID,
      githubLogin: "alice",
    });
    // Default: resolved to a fresh UUID per test
    mocks.resolveAppUser.mockResolvedValue({ id: freshUUID() });
  });

  // ── authentication ────────────────────────────────────────────────────────

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when resolveAppUser returns null", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  // ── ownership: user.id not githubId ──────────────────────────────────────

  it("calls resolveAppUser with the session githubId and githubLogin", async () => {
    setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    await GET(makeRequest());
    expect(mocks.resolveAppUser).toHaveBeenCalledWith(GITHUB_ID, "alice");
  });

  it("stores insights with users.id (UUID), not session.githubId (numeric string)", async () => {
    const uuid = freshUUID();
    mocks.resolveAppUser.mockResolvedValue({ id: uuid });
    const { upsertChain } = setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    await GET(makeRequest());

    expect(upsertChain).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: uuid }),
      expect.any(Object)
    );
    // Must NOT use the GitHub numeric ID as the user_id
    expect(upsertChain).not.toHaveBeenCalledWith(
      expect.objectContaining({ user_id: GITHUB_ID }),
      expect.any(Object)
    );
  });

  it("queries the cache with users.id, not githubId", async () => {
    const uuid = freshUUID();
    mocks.resolveAppUser.mockResolvedValue({ id: uuid });
    const { eqUserId } = setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    await GET(makeRequest());

    // The first .eq() in the select chain filters by user_id
    expect(eqUserId).toHaveBeenCalledWith("user_id", uuid);
  });

  // ── regression: orphaned-record scenario (#1750) ──────────────────────────

  it("does not use githubId as the user_id in any DB operation", async () => {
    const uuid = freshUUID();
    mocks.resolveAppUser.mockResolvedValue({ id: uuid });
    const { upsertChain } = setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    await GET(makeRequest());

    const upsertArgs = upsertChain.mock.calls.flatMap((call) => call);
    const upsertedIds = upsertArgs
      .filter((a) => a && typeof a === "object" && "user_id" in a)
      .map((a: any) => a.user_id);

    expect(upsertedIds).not.toContain(GITHUB_ID);
    upsertedIds.forEach((id: string) => expect(id).toBe(uuid));
  });

  // ── cache-hit path ────────────────────────────────────────────────────────

  it("returns cached insight when a fresh record exists", async () => {
    const cachedContent = { insights: [], trend: {}, aiSummary: null };
    setupSupabaseCacheHit(cachedContent);
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.data).toEqual(cachedContent);
  });

  // ── insight_type validation ───────────────────────────────────────────────

  it("returns 400 for an unrecognised insight type", async () => {
    setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest("totally_wrong"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid insight type/i);
  });

  it("accepts weekly_summary as a valid type", async () => {
    setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest("weekly_summary"));
    expect(res.status).toBe(200);
  });

  it("accepts pattern as a valid type", async () => {
    setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest("pattern"));
    expect(res.status).toBe(200);
  });

  it("accepts recommendation as a valid type", async () => {
    setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest("recommendation"));
    expect(res.status).toBe(200);
  });

  // ── upsert conflict key ───────────────────────────────────────────────────

  it("upserts with user_id,insight_type conflict target", async () => {
    const { upsertChain } = setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    await GET(makeRequest());

    expect(upsertChain).toHaveBeenCalledWith(
      expect.any(Object),
      { onConflict: "user_id,insight_type" }
    );
  });

  // ── full cache-miss response shape ────────────────────────────────────────

  it("returns { data, cached: false } on a cache miss", async () => {
    setupSupabaseCacheMiss();
    const { GET } = await import("@/app/api/ai-insights/route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(body.data).toBeDefined();
  });
});
