/**
 * Regression tests for the weekly digest cron authentication bypass
 * described in issue #1745.
 *
 * Background
 * ----------
 * The original guard used short-circuit AND evaluation:
 *
 *   if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 *     return 401
 *   }
 *
 * When CRON_SECRET is undefined, `undefined && ...` is falsy, so the entire
 * condition is skipped and the endpoint executes without any authentication.
 * Any unauthenticated HTTP GET to the route would trigger bulk email delivery
 * to every opted-in user.
 *
 * Fix
 * ---
 * The guard was replaced with a fail-closed pattern that matches every other
 * cron endpoint in the codebase:
 *
 *   const cronSecret = process.env.CRON_SECRET;
 *   if (!cronSecret) return 500   // missing config
 *   if (authHeader !== `Bearer ${cronSecret}`) return 401
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/weekly-digest/route";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  resendFetch: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

vi.stubGlobal("fetch", mocks.resendFetch);

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/weekly-digest", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

/** Configure Supabase to return the given opted-in users. */
function stubUsers(users: Array<{ github_login: string; email: string }>) {
  const notChain = vi.fn().mockResolvedValue({ data: users, error: null });
  const eqChain  = vi.fn().mockReturnValue({ not: notChain });
  const selChain = vi.fn().mockReturnValue({ eq: eqChain });
  mocks.supabaseFrom.mockReturnValue({ select: selChain });
}

/** Configure Supabase to return no opted-in users. */
function stubNoUsers() {
  stubUsers([]);
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("GET /api/cron/weekly-digest — authentication hardening (#1745)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("GITHUB_TOKEN", "");
    stubNoUsers();
  });

  // ── missing CRON_SECRET — fail closed ─────────────────────────────────────

  it("returns 500 when CRON_SECRET is not set — regression for #1745", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await GET(makeRequest("Bearer anything"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET.*not configured/i);
    // Supabase must never be called — no user emails should be fetched
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 500 for a request with no auth header when CRON_SECRET is absent — regression for #1745", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    expect(mocks.resendFetch).not.toHaveBeenCalled();
  });

  // ── wrong secret — reject ─────────────────────────────────────────────────

  it("returns 401 when the Authorization header is absent and CRON_SECRET is set", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header contains the wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const res = await GET(makeRequest("Bearer wrong-secret"));

    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    expect(mocks.resendFetch).not.toHaveBeenCalled();
  });

  it("returns 401 for a plaintext secret without the Bearer prefix", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const res = await GET(makeRequest("correct-secret"));

    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // ── correct secret — allow ────────────────────────────────────────────────

  it("returns 200 when the correct Bearer token is supplied and no users are opted in", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");

    const res = await GET(makeRequest("Bearer s3cr3t"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("No users opted in");
    expect(mocks.resendFetch).not.toHaveBeenCalled();
  });

  // ── email sending ─────────────────────────────────────────────────────────

  it("sends digest emails to opted-in users when authenticated and RESEND_API_KEY is set", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    stubUsers([
      { github_login: "alice", email: "alice@example.com" },
      { github_login: "bob", email: "bob@example.com" },
    ]);
    mocks.resendFetch.mockResolvedValue({ ok: true });

    const res = await GET(makeRequest("Bearer s3cr3t"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sentCount).toBe(2);
    // One POST to Resend for each user
    expect(mocks.resendFetch).toHaveBeenCalledTimes(2);
  });

  it("counts sent emails even when RESEND_API_KEY is absent (no network call made)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("RESEND_API_KEY", "");
    stubUsers([{ github_login: "charlie", email: "charlie@example.com" }]);

    const res = await GET(makeRequest("Bearer s3cr3t"));

    expect(res.status).toBe(200);
    const body = await res.json();
    // sentCount still increments so the response reflects how many users were
    // eligible, but no external call is made
    expect(body.sentCount).toBe(1);
    expect(mocks.resendFetch).not.toHaveBeenCalled();
  });

  it("does not send emails when authentication fails even if opted-in users exist", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    // Even if the DB would return users, the auth check fires first
    stubUsers([{ github_login: "eve", email: "eve@example.com" }]);

    const res = await GET(makeRequest("Bearer wrong"));

    expect(res.status).toBe(401);
    expect(mocks.resendFetch).not.toHaveBeenCalled();
  });

  it("returns 500 and does not query the database when CRON_SECRET is absent regardless of user data", async () => {
    vi.stubEnv("CRON_SECRET", "");
    // Even though the DB would return users, the config check fires first
    stubUsers([{ github_login: "mallory", email: "mallory@example.com" }]);

    const res = await GET(makeRequest("Bearer s3cr3t"));

    expect(res.status).toBe(500);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    expect(mocks.resendFetch).not.toHaveBeenCalled();
  });

  // ── database error handling ───────────────────────────────────────────────

  it("returns 500 when the database query fails", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    const notChain = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eqChain  = vi.fn().mockReturnValue({ not: notChain });
    const selChain = vi.fn().mockReturnValue({ eq: eqChain });
    mocks.supabaseFrom.mockReturnValue({ select: selChain });

    const res = await GET(makeRequest("Bearer s3cr3t"));

    expect(res.status).toBe(500);
    expect(mocks.resendFetch).not.toHaveBeenCalled();
  });

  // ── email personalisation ─────────────────────────────────────────────────

  it("addresses emails to the correct user and includes their github_login", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    stubUsers([{ github_login: "devtracker", email: "devtracker@example.com" }]);
    mocks.resendFetch.mockResolvedValue({ ok: true });

    await GET(makeRequest("Bearer s3cr3t"));

    expect(mocks.resendFetch).toHaveBeenCalledOnce();

    const [, callOptions] = mocks.resendFetch.mock.calls[0];
    const body = JSON.parse(callOptions.body);

    expect(body.to).toBe("devtracker@example.com");
    expect(body.html).toContain("devtracker");
  });
});
