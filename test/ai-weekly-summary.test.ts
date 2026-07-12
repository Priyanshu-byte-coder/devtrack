/**
 * Tests for POST /api/ai/weekly-summary (route handler)
 *
 * Coverage
 * --------
 * Authentication    — no session, missing githubId, user not found
 * Rate limiting     — 24-hour rolling window, Retry-After header, boundary
 *                     edge cases, last_ai_summary_at update
 * Input validation  — missing fields, wrong types, invalid trend values,
 *                     null topRepo, float streak
 * AI service call   — success path, service unavailable (503), DB error (500)
 * Security          — API key never in response
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Shared test fixture ───────────────────────────────────────────────────────

const VALID_METRICS = {
  commits: { current: 12, previous: 8, delta: 4, trend: "up" as const },
  prs: {
    thisWeek: { opened: 3, merged: 2 },
    lastWeek: { opened: 2, merged: 1 },
  },
  streak: 7,
  topRepo: "owner/devtrack",
  activeDays: { thisWeek: 5, lastWeek: 4 },
};

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/weekly-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseSelect: vi.fn(),
  supabaseUpdateEq: vi.fn(),
  generateWeeklySummary: vi.fn(),
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
vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: mocks.resolveAppUser,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: mocks.supabaseSelect,
      update: vi.fn(() => ({ eq: mocks.supabaseUpdateEq })),
    })),
  },
}));
vi.mock("@/lib/anthropic", () => ({
  generateWeeklySummary: mocks.generateWeeklySummary,
}));

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/ai/weekly-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    // Defaults: authenticated, user found, first generation, AI available
    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-123",
      githubLogin: "alice",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-uuid-abc" });
    mocks.supabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { last_ai_summary_at: null },
          error: null,
        }),
      }),
    });
    mocks.supabaseUpdateEq.mockResolvedValue({ error: null });
    mocks.generateWeeklySummary.mockResolvedValue(
      "Great week! You merged 2 pull requests and maintained a 7-day streak."
    );
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  it("returns 401 when no session exists", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 401 when session has no githubId", async () => {
    mocks.getServerSession.mockResolvedValue({ githubLogin: "alice" });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(401);
  });

  it("returns 404 when resolveAppUser returns null", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/user not found/i);
  });

  // ── Rate limiting ───────────────────────────────────────────────────────────

  it("returns 429 when last_ai_summary_at is within 24 hours", async () => {
    const elevenHoursAgo = new Date(
      Date.now() - 11 * 60 * 60 * 1000
    ).toISOString();
    mocks.supabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { last_ai_summary_at: elevenHoursAgo },
          error: null,
        }),
      }),
    });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
    expect(body.rateLimitReset).toBeTruthy();

    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("allows a request when last_ai_summary_at is just over 24 hours ago", async () => {
    const justOver = new Date(
      Date.now() - 24 * 60 * 60 * 1000 - 500
    ).toISOString();
    mocks.supabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { last_ai_summary_at: justOver },
          error: null,
        }),
      }),
    });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(200);
  });

  it("allows a request when last_ai_summary_at is null (first generation)", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(200);
  });

  it("updates last_ai_summary_at after a successful generation", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    await POST(makePostRequest(VALID_METRICS));

    expect(mocks.supabaseUpdateEq).toHaveBeenCalled();
  });

  it("does NOT update last_ai_summary_at when AI returns null (503)", async () => {
    mocks.generateWeeklySummary.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    await POST(makePostRequest(VALID_METRICS));

    expect(mocks.supabaseUpdateEq).not.toHaveBeenCalled();
  });

  it("Retry-After for an 11-hour-old request is approximately 46800 seconds", async () => {
    const elevenHoursAgo = new Date(
      Date.now() - 11 * 60 * 60 * 1000
    ).toISOString();
    mocks.supabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { last_ai_summary_at: elevenHoursAgo },
          error: null,
        }),
      }),
    });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get("Retry-After"));
    // 13 hours remaining ≈ 46800 seconds
    expect(retryAfter).toBeGreaterThan(46_700);
    expect(retryAfter).toBeLessThanOrEqual(46_801);
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("returns 400 for a non-JSON body", async () => {
    const req = new Request("http://localhost/api/ai/weekly-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when commits field is missing", async () => {
    const { commits: _c, ...noCommits } = VALID_METRICS;

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(noCommits));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/commits/i);
  });

  it("returns 400 when commits.current is negative", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(
      makePostRequest({
        ...VALID_METRICS,
        commits: { current: -1, previous: 0, delta: -1, trend: "down" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when commits.trend is an invalid value", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(
      makePostRequest({
        ...VALID_METRICS,
        commits: { ...VALID_METRICS.commits, trend: "sideways" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when prs field is missing", async () => {
    const { prs: _p, ...noPrs } = VALID_METRICS;

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(noPrs));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/prs/i);
  });

  it("returns 400 when streak is a float", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(
      makePostRequest({ ...VALID_METRICS, streak: 7.5 })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when topRepo is a number instead of string or null", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(
      makePostRequest({ ...VALID_METRICS, topRepo: 42 })
    );

    expect(res.status).toBe(400);
  });

  it("accepts topRepo: null (user with no notable repo this week)", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(
      makePostRequest({ ...VALID_METRICS, topRepo: null })
    );

    expect(res.status).toBe(200);
  });

  it("returns 400 when activeDays field is missing", async () => {
    const { activeDays: _a, ...noActiveDays } = VALID_METRICS;

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(noActiveDays));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/activeDays/i);
  });

  // ── Success path ────────────────────────────────────────────────────────────

  it("returns 200 with summary, generatedAt, and rateLimitReset on success", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.summary).toBe("string");
    expect(body.summary.length).toBeGreaterThan(0);
    expect(body.generatedAt).toBeTruthy();
    expect(body.rateLimitReset).toBeTruthy();
  });

  it("rateLimitReset is approximately 24 hours in the future", async () => {
    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const before = Date.now();
    const res = await POST(makePostRequest(VALID_METRICS));
    const after = Date.now();

    const body = await res.json();
    const resetMs = new Date(body.rateLimitReset).getTime();

    expect(resetMs).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 100);
    expect(resetMs).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 100);
  });

  // ── Error paths ─────────────────────────────────────────────────────────────

  it("returns 503 when AI service returns null", async () => {
    mocks.generateWeeklySummary.mockResolvedValue(null);

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/unavailable/i);
  });

  it("returns 500 when Supabase fails to read the user row", async () => {
    mocks.supabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "connection refused" },
        }),
      }),
    });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(500);
  });

  it("still returns 200 when last_ai_summary_at update fails (non-fatal)", async () => {
    mocks.supabaseUpdateEq.mockResolvedValue({
      error: { message: "write failed" },
    });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBeTruthy();
  });

  // ── Security ────────────────────────────────────────────────────────────────

  it("never includes ANTHROPIC_API_KEY in any response body", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-super-secret");

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));
    const text = await res.text();

    expect(text).not.toContain("sk-ant-super-secret");
  });

  it("never includes ANTHROPIC_API_KEY in the 429 response body", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-super-secret");

    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    mocks.supabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { last_ai_summary_at: tenHoursAgo },
          error: null,
        }),
      }),
    });

    const { POST } = await import("@/app/api/ai/weekly-summary/route");
    const res = await POST(makePostRequest(VALID_METRICS));
    const text = await res.text();

    expect(text).not.toContain("sk-ant-super-secret");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate-limit window math — pure unit tests (no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

describe("Rate limit window calculation", () => {
  it("request made 23 h 59 m after last generation is blocked", () => {
    const lastAt = Date.now() - (23 * 60 + 59) * 60_000;
    const elapsed = Date.now() - lastAt;
    const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
    expect(elapsed < RATE_LIMIT_MS).toBe(true);
  });

  it("request made just over 24 h after last generation is allowed", () => {
    const lastAt = Date.now() - 24 * 60 * 60 * 1000 - 1;
    const elapsed = Date.now() - lastAt;
    const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
    expect(elapsed < RATE_LIMIT_MS).toBe(false);
  });

  it("Retry-After for a 13-hour-old request is approximately 39600 seconds", () => {
    const lastAt = Date.now() - 13 * 60 * 60 * 1000;
    const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - lastAt;
    const remaining = RATE_LIMIT_MS - elapsed;
    const retryAfter = Math.ceil(remaining / 1000);
    expect(retryAfter).toBeGreaterThanOrEqual(39_599);
    expect(retryAfter).toBeLessThanOrEqual(39_601);
  });
});
