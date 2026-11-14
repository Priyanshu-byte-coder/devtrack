import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class InsightMetricsUnavailableError extends Error {
    constructor(public readonly response: Response) {
      super("Insight metrics unavailable");
    }
  }
  return {
    getServerSession: vi.fn(),
    resolveAppUser: vi.fn(),
    upsert: vi.fn(),
    metrics: vi.fn(),
    fetch: vi.fn(),
    InsightMetricsUnavailableError,
  };
});

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/insight-metrics", () => ({
  loadInsightMetrics: mocks.metrics,
  InsightMetricsUnavailableError: mocks.InsightMetricsUnavailableError,
}));
vi.mock("@/lib/supabase", () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const chain: Record<string, unknown> = {};
  for (const m of ["eq", "gte", "order", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = maybeSingle;
  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(chain),
        upsert: mocks.upsert,
      }),
    },
  };
});

vi.stubGlobal("fetch", mocks.fetch);

let counter = 0;
const request = () =>
  new Request("http://localhost/api/personality", {
    headers: { cookie: "next-auth.session-token=tok" },
  });

describe("GET /api/personality — metric loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GROQ_API_KEY;
    counter += 1;
    mocks.getServerSession.mockResolvedValue({
      githubId: "1",
      githubLogin: "alice",
    });
    // Unique user per test so the in-memory rate limiter never interferes.
    mocks.resolveAppUser.mockResolvedValue({ id: `user-${counter}` });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("loads metrics in-process and never fetches its own API routes", async () => {
    mocks.metrics.mockResolvedValue([
      {
        data: { "2026-01-01": 3, "2026-01-02": 2 },
        total: 5,
        timeBlocks: { morning: 1, afternoon: 1, evening: 1, night: 2 },
      },
      { open: 1, merged: 4, avgReviewHours: 48 },
      { current: 2, longest: 5, totalActiveDays: 2 },
      { repos: [{ name: "devtrack", commits: 5 }] },
    ]);
    const { GET } = await import("@/app/api/personality/route");
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(mocks.metrics).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and caches nothing when metrics are unavailable", async () => {
    mocks.metrics.mockRejectedValue(
      new mocks.InsightMetricsUnavailableError(
        Response.json({ error: "down" }, { status: 502 })
      )
    );
    const { GET } = await import("@/app/api/personality/route");
    const res = await GET(request());

    expect(res.status).toBe(503);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("passes through 429 with Retry-After from the metric handlers", async () => {
    mocks.metrics.mockRejectedValue(
      new mocks.InsightMetricsUnavailableError(
        Response.json(
          { error: "quota" },
          { status: 429, headers: { "Retry-After": "90" } }
        )
      )
    );
    const { GET } = await import("@/app/api/personality/route");
    const res = await GET(request());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("90");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
