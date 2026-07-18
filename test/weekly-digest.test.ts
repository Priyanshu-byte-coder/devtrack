/**
 * Tests for the weekly email digest system (#1028).
 *
 * Coverage:
 *   - Unsubscribe token generation and verification
 *   - Unsubscribe API endpoint (GET /api/unsubscribe)
 *   - Digest email template rendering (HTML + text)
 *   - Weekly digest cron endpoint — new behaviours on top of the auth
 *     regression tests that already live in weekly-digest-cron-auth.test.ts:
 *     • cooldown / duplicate-send prevention
 *     • partial failure handling (one bad user does not stop the batch)
 *     • metrics fetched only when GITHUB_TOKEN is configured
 *     • response shape: sentCount / failedCount / skippedCount / errors
 *     • opted-in filter delegated to the DB query
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  fetchGlobal: vi.fn(),
  buildDigestMetrics: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

vi.stubGlobal("fetch", mocks.fetchGlobal);

vi.mock("@/lib/weekly-digest", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/weekly-digest")>();
  return {
    ...original,
    // Keep real token helpers; stub only the heavy metrics fetch.
    buildDigestMetrics: mocks.buildDigestMetrics,
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCronRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/weekly-digest", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function makeUnsubRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/unsubscribe");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

/** Configure supabase to return given user rows from the cron query chain. */
function stubCronUsers(
  users: Array<{
    id?: string;
    github_login: string;
    email: string;
    timezone?: string;
    last_digest_sent_at?: string | null;
  }>
) {
  const notChain = vi.fn().mockResolvedValue({ data: users, error: null });
  const eqChain = vi.fn().mockReturnValue({ not: notChain });
  const selChain = vi.fn().mockReturnValue({ eq: eqChain });
  mocks.supabaseFrom.mockReturnValue({ select: selChain });
}

/** Configure supabase unsubscribe update to succeed. */
function stubUnsubUpdate() {
  const eqChain = vi.fn().mockResolvedValue({ error: null });
  const updChain = vi.fn().mockReturnValue({ eq: eqChain });
  mocks.supabaseFrom.mockReturnValue({ update: updChain });
}

/** Configure supabase unsubscribe update to fail. */
function stubUnsubUpdateError() {
  const eqChain = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
  const updChain = vi.fn().mockReturnValue({ eq: eqChain });
  mocks.supabaseFrom.mockReturnValue({ update: updChain });
}

// ─── Unsubscribe token utilities ──────────────────────────────────────────────

describe("generateUnsubscribeToken / verifyUnsubscribeToken", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-tokens");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("generates a 64-char hex string", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    const token = generateUnsubscribeToken("user-abc-123");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same user ID", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    const t1 = generateUnsubscribeToken("user-xyz");
    const t2 = generateUnsubscribeToken("user-xyz");
    expect(t1).toBe(t2);
  });

  it("differs across user IDs", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    expect(generateUnsubscribeToken("user-1")).not.toBe(
      generateUnsubscribeToken("user-2")
    );
  });

  it("verifies a correct token", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/weekly-digest"
    );
    const uid = "user-verify-test";
    const token = generateUnsubscribeToken(uid);
    expect(verifyUnsubscribeToken(uid, token)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/weekly-digest"
    );
    const uid = "user-tamper-test";
    const token = generateUnsubscribeToken(uid);
    const tampered = token.slice(0, -2) + "00";
    expect(verifyUnsubscribeToken(uid, tampered)).toBe(false);
  });

  it("rejects a token issued for a different user", async () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/weekly-digest"
    );
    const tokenForA = generateUnsubscribeToken("user-a");
    expect(verifyUnsubscribeToken("user-b", tokenForA)).toBe(false);
  });

  it("rejects an empty token string", async () => {
    const { verifyUnsubscribeToken } = await import("@/lib/weekly-digest");
    expect(verifyUnsubscribeToken("user-x", "")).toBe(false);
  });

  it("prefers DIGEST_UNSUBSCRIBE_SECRET over NEXTAUTH_SECRET", async () => {
    vi.stubEnv("DIGEST_UNSUBSCRIBE_SECRET", "dedicated-secret");
    vi.resetModules();
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/weekly-digest"
    );
    const uid = "user-dedicated";
    const token = generateUnsubscribeToken(uid);
    expect(verifyUnsubscribeToken(uid, token)).toBe(true);
  });
});

// ─── GET /api/unsubscribe ─────────────────────────────────────────────────────

describe("GET /api/unsubscribe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-unsub");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 when uid is missing", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    const { GET } = await import("@/app/api/unsubscribe/route");
    const token = generateUnsubscribeToken("some-uid");
    const res = await GET(makeUnsubRequest({ token }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const res = await GET(
      makeUnsubRequest({ uid: "00000000-0000-0000-0000-000000000001" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when uid is not a valid UUID", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const res = await GET(makeUnsubRequest({ uid: "not-a-uuid", token: "abc" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when token does not match uid", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    const { GET } = await import("@/app/api/unsubscribe/route");
    const tokenForA = generateUnsubscribeToken("00000000-0000-0000-0000-000000000001");
    const res = await GET(
      makeUnsubRequest({
        uid: "00000000-0000-0000-0000-000000000002",
        token: tokenForA,
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for a completely invalid token", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const res = await GET(
      makeUnsubRequest({
        uid: "00000000-0000-0000-0000-000000000003",
        token: "definitely-not-valid",
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns HTML confirmation on successful unsubscribe", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    const { GET } = await import("@/app/api/unsubscribe/route");
    const uid = "00000000-0000-0000-0000-000000000004";
    const token = generateUnsubscribeToken(uid);
    stubUnsubUpdate();

    const res = await GET(makeUnsubRequest({ uid, token }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/i);
    const html = await res.text();
    expect(html).toContain("unsubscribed");
  });

  it("sets weekly_digest_opt_in to false in the database", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    const { GET } = await import("@/app/api/unsubscribe/route");
    const uid = "00000000-0000-0000-0000-000000000005";
    const token = generateUnsubscribeToken(uid);

    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updFn = vi.fn().mockReturnValue({ eq: eqFn });
    mocks.supabaseFrom.mockReturnValue({ update: updFn });

    await GET(makeUnsubRequest({ uid, token }));

    expect(updFn).toHaveBeenCalledWith({ weekly_digest_opt_in: false });
    expect(eqFn).toHaveBeenCalledWith("id", uid);
  });

  it("returns 500 when the database update fails", async () => {
    const { generateUnsubscribeToken } = await import("@/lib/weekly-digest");
    const { GET } = await import("@/app/api/unsubscribe/route");
    const uid = "00000000-0000-0000-0000-000000000006";
    const token = generateUnsubscribeToken(uid);
    stubUnsubUpdateError();

    const res = await GET(makeUnsubRequest({ uid, token }));
    expect(res.status).toBe(500);
  });
});

// ─── Email template ───────────────────────────────────────────────────────────

describe("buildDigestHtml", () => {
  it("includes the github_login in the greeting", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const html = buildDigestHtml({
      githubLogin: "octocat",
      metrics: null,
      unsubscribeUrl: "https://example.com/unsubscribe",
      weekLabel: "1 June 2025",
    });
    expect(html).toContain("octocat");
  });

  it("includes the unsubscribe URL", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const url = "https://example.com/api/unsubscribe?uid=abc&token=xyz";
    const html = buildDigestHtml({
      githubLogin: "user",
      metrics: null,
      unsubscribeUrl: url,
      weekLabel: "1 June 2025",
    });
    expect(html).toContain("uid=abc");
    expect(html).toContain("token=xyz");
  });

  it("renders streak section when streak > 0", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const html = buildDigestHtml({
      githubLogin: "user",
      metrics: {
        streak: { current: 12, longest: 30, lastCommitDate: "2025-06-01" },
        weeklyCommits: 10,
        weeklyActiveDays: 5,
        prsThisWeek: 2,
        topLanguages: [],
        topRepos: [],
      },
      unsubscribeUrl: "",
      weekLabel: "1 June 2025",
    });
    expect(html).toContain("12");
    expect(html).toContain("30");
  });

  it("renders weekly commit and PR counts", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const html = buildDigestHtml({
      githubLogin: "user",
      metrics: {
        streak: { current: 0, longest: 0, lastCommitDate: null },
        weeklyCommits: 47,
        weeklyActiveDays: 6,
        prsThisWeek: 3,
        topLanguages: [],
        topRepos: [],
      },
      unsubscribeUrl: "",
      weekLabel: "1 June 2025",
    });
    expect(html).toContain("47");
    expect(html).toContain("3");
  });

  it("renders top languages section", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const html = buildDigestHtml({
      githubLogin: "user",
      metrics: {
        streak: { current: 0, longest: 0, lastCommitDate: null },
        weeklyCommits: 0,
        weeklyActiveDays: 0,
        prsThisWeek: 0,
        topLanguages: [
          { name: "TypeScript", percentage: 72.5 },
          { name: "Python", percentage: 20.0 },
        ],
        topRepos: [],
      },
      unsubscribeUrl: "",
      weekLabel: "1 June 2025",
    });
    expect(html).toContain("TypeScript");
    expect(html).toContain("Python");
    expect(html).toContain("72.5");
  });

  it("renders top repos with links", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const html = buildDigestHtml({
      githubLogin: "user",
      metrics: {
        streak: { current: 0, longest: 0, lastCommitDate: null },
        weeklyCommits: 0,
        weeklyActiveDays: 0,
        prsThisWeek: 0,
        topLanguages: [],
        topRepos: [
          {
            name: "org/my-project",
            commits: 15,
            url: "https://github.com/org/my-project",
          },
        ],
      },
      unsubscribeUrl: "",
      weekLabel: "1 June 2025",
    });
    expect(html).toContain("org/my-project");
    expect(html).toContain("https://github.com/org/my-project");
    expect(html).toContain("15");
  });

  it("shows fallback dashboard link when metrics are null", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const html = buildDigestHtml({
      githubLogin: "user",
      metrics: null,
      unsubscribeUrl: "",
      weekLabel: "1 June 2025",
    });
    expect(html).toContain("dashboard");
  });

  it("escapes HTML in github_login to prevent injection", async () => {
    const { buildDigestHtml } = await import("@/lib/digest-email");
    const html = buildDigestHtml({
      githubLogin: "<script>alert('xss')</script>",
      metrics: null,
      unsubscribeUrl: "",
      weekLabel: "1 June 2025",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildDigestText", () => {
  it("includes github_login", async () => {
    const { buildDigestText } = await import("@/lib/digest-email");
    const text = buildDigestText({
      githubLogin: "octocat",
      metrics: null,
      unsubscribeUrl: "https://example.com/unsub",
      weekLabel: "1 June 2025",
    });
    expect(text).toContain("octocat");
  });

  it("includes the unsubscribe URL", async () => {
    const { buildDigestText } = await import("@/lib/digest-email");
    const text = buildDigestText({
      githubLogin: "user",
      metrics: null,
      unsubscribeUrl: "https://example.com/api/unsubscribe?uid=x&token=y",
      weekLabel: "1 June 2025",
    });
    expect(text).toContain("https://example.com/api/unsubscribe?uid=x&token=y");
  });

  it("includes streak when current > 0", async () => {
    const { buildDigestText } = await import("@/lib/digest-email");
    const text = buildDigestText({
      githubLogin: "user",
      metrics: {
        streak: { current: 7, longest: 14, lastCommitDate: null },
        weeklyCommits: 5,
        weeklyActiveDays: 4,
        prsThisWeek: 1,
        topLanguages: [],
        topRepos: [],
      },
      unsubscribeUrl: "",
      weekLabel: "1 June 2025",
    });
    expect(text).toContain("7");
    expect(text).toContain("Commits");
  });
});

// ─── Cron route — new behaviours ─────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — new behaviours", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    mocks.fetchGlobal.mockResolvedValue({ ok: true });
    stubCronUsers([]);
    mocks.buildDigestMetrics.mockResolvedValue({
      streak: { current: 5, longest: 10, lastCommitDate: "2025-06-01" },
      weeklyCommits: 20,
      weeklyActiveDays: 5,
      prsThisWeek: 3,
      topLanguages: [{ name: "TypeScript", percentage: 90 }],
      topRepos: [],
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Response shape ──────────────────────────────────────────────────────────

  it("response includes sentCount, failedCount, skippedCount, errors", async () => {
    stubCronUsers([{ github_login: "alice", email: "alice@example.com" }]);
    vi.stubEnv("GITHUB_TOKEN", "gh-token");
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("sentCount");
    expect(body).toHaveProperty("failedCount");
    expect(body).toHaveProperty("skippedCount");
    expect(body).toHaveProperty("errors");
  });

  // ── Cooldown / duplicate-send prevention ────────────────────────────────────

  it("skips a user whose last_digest_sent_at is within 6 days", async () => {
    const recentSend = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    ).toISOString();
    stubCronUsers([
      {
        id: "00000000-0000-0000-0000-000000000007",
        github_login: "bob",
        email: "bob@example.com",
        last_digest_sent_at: recentSend,
      },
    ]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skippedCount).toBe(1);
    expect(body.sentCount).toBe(0);
    expect(mocks.fetchGlobal).not.toHaveBeenCalled();
  });

  it("sends to a user whose last_digest_sent_at is older than 6 days", async () => {
    const oldSend = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000
    ).toISOString();
    stubCronUsers([
      {
        id: "00000000-0000-0000-0000-000000000008",
        github_login: "carol",
        email: "carol@example.com",
        last_digest_sent_at: oldSend,
      },
    ]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skippedCount).toBe(0);
    expect(mocks.fetchGlobal).toHaveBeenCalledOnce();
  });

  it("sends to a user with null last_digest_sent_at (never sent)", async () => {
    stubCronUsers([
      {
        id: "00000000-0000-0000-0000-000000000009",
        github_login: "dave",
        email: "dave@example.com",
        last_digest_sent_at: null,
      },
    ]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    expect(res.status).toBe(200);
    expect(mocks.fetchGlobal).toHaveBeenCalledOnce();
  });

  // ── Metrics fetching ────────────────────────────────────────────────────────

  it("fetches metrics when GITHUB_TOKEN is set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "gh-token");
    stubCronUsers([{ github_login: "eve", email: "eve@example.com" }]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    await GET(makeCronRequest("Bearer secret"));
    expect(mocks.buildDigestMetrics).toHaveBeenCalledWith("eve", "gh-token");
  });

  it("does not fetch metrics when GITHUB_TOKEN is absent", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    stubCronUsers([{ github_login: "frank", email: "frank@example.com" }]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    await GET(makeCronRequest("Bearer secret"));
    expect(mocks.buildDigestMetrics).not.toHaveBeenCalled();
    // Email still sent without metrics
    expect(mocks.fetchGlobal).toHaveBeenCalledOnce();
  });

  it("still sends the email when metrics fetch throws", async () => {
    vi.stubEnv("GITHUB_TOKEN", "gh-token");
    mocks.buildDigestMetrics.mockRejectedValue(new Error("GitHub API down"));
    stubCronUsers([{ github_login: "grace", email: "grace@example.com" }]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sentCount).toBeGreaterThanOrEqual(1);
    expect(mocks.fetchGlobal).toHaveBeenCalledOnce();
  });

  // ── Partial failure handling ─────────────────────────────────────────────────

  it("continues processing when one Resend call fails", async () => {
    stubCronUsers([
      { github_login: "user1", email: "u1@example.com" },
      { github_login: "user2", email: "u2@example.com" },
      { github_login: "user3", email: "u3@example.com" },
    ]);
    // First call fails, rest succeed
    mocks.fetchGlobal
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      })
      .mockResolvedValue({ ok: true });

    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.failedCount).toBe(1);
    expect(body.sentCount).toBeGreaterThanOrEqual(2);
    expect(body.errors).toHaveLength(1);
    expect(mocks.fetchGlobal).toHaveBeenCalledTimes(3);
  });

  it("populates errors array when a send fails", async () => {
    stubCronUsers([{ github_login: "heidi", email: "heidi@example.com" }]);
    mocks.fetchGlobal.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Unprocessable entity",
    });
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    const body = await res.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].user).toBe("heidi");
    expect(body.errors[0].error).toContain("422");
  });

  // ── Mixed eligible / cooldown ────────────────────────────────────────────────

  it("counts sent and skipped correctly for mixed user states", async () => {
    const recentSend = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();
    stubCronUsers([
      {
        github_login: "eligible",
        email: "ok@example.com",
        last_digest_sent_at: null,
      },
      {
        github_login: "cooldown",
        email: "cool@example.com",
        last_digest_sent_at: recentSend,
      },
    ]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    const res = await GET(makeCronRequest("Bearer secret"));
    const body = await res.json();
    expect(body.skippedCount).toBe(1);
    expect(body.sentCount).toBe(1);
    expect(mocks.fetchGlobal).toHaveBeenCalledTimes(1);
  });

  // ── Email content ────────────────────────────────────────────────────────────

  it("sends email to the correct address", async () => {
    stubCronUsers([{ github_login: "ivan", email: "ivan@example.com" }]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    await GET(makeCronRequest("Bearer secret"));
    const [, opts] = mocks.fetchGlobal.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.to).toBe("ivan@example.com");
  });

  it("includes github_login in the HTML body", async () => {
    stubCronUsers([{ github_login: "judith", email: "judith@example.com" }]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    await GET(makeCronRequest("Bearer secret"));
    const [, opts] = mocks.fetchGlobal.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.html).toContain("judith");
  });

  it("includes a text/plain body alongside HTML", async () => {
    stubCronUsers([{ github_login: "karl", email: "karl@example.com" }]);
    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    await GET(makeCronRequest("Bearer secret"));
    const [, opts] = mocks.fetchGlobal.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(typeof body.text).toBe("string");
    expect(body.text.length).toBeGreaterThan(0);
    expect(body.text).toContain("karl");
  });

  // ── DB query contract ────────────────────────────────────────────────────────

  it("filters by weekly_digest_opt_in=true and requires a non-null email", async () => {
    const notFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqFn = vi.fn().mockReturnValue({ not: notFn });
    const selFn = vi.fn().mockReturnValue({ eq: eqFn });
    mocks.supabaseFrom.mockReturnValue({ select: selFn });

    const { GET } = await import("@/app/api/cron/weekly-digest/route");
    await GET(makeCronRequest("Bearer secret"));

    expect(eqFn).toHaveBeenCalledWith("weekly_digest_opt_in", true);
    expect(notFn).toHaveBeenCalledWith("email", "is", null);
  });
});
