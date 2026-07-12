/**
 * Regression tests for the debug health endpoint information disclosure
 * vulnerability described in issue #1816.
 *
 * Background
 * ----------
 * The original endpoint required only ENABLE_DEBUG_ENDPOINT=true.  With that
 * single env-var set, any remote caller could receive:
 *   - Secret-presence indicators (NEXTAUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY, …)
 *   - The caller's githubId and githubLogin from their session
 *
 * Fix
 * ---
 * Three access-control gates are now enforced in sequence:
 *   1. ENABLE_DEBUG_ENDPOINT must be "true"
 *   2. DEBUG_SECRET must be set in the environment
 *   3. Authorization: Bearer <DEBUG_SECRET> must match
 *
 * The response no longer includes:
 *   - Any secret-presence indicators
 *   - githubId or githubLogin
 * It retains only non-sensitive operational data (timestamp, DB health, auth boolean).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  supabaseFrom: vi.fn(),
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
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

const VALID_SECRET = "super-strong-debug-secret";

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest("http://localhost/api/debug/health", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function stubHealthyDb() {
  const limitMock = vi.fn().mockResolvedValue({ error: null });
  const selectMock = vi.fn().mockReturnValue({ limit: limitMock });
  mocks.supabaseFrom.mockReturnValue({ select: selectMock });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("GET /api/debug/health — access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.getServerSession.mockResolvedValue(null);
    stubHealthyDb();
  });

  // ── gate 1: feature flag ────────────────────────────────────────────────

  it("returns 403 when ENABLE_DEBUG_ENDPOINT is not set", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "");
    vi.stubEnv("DEBUG_SECRET", VALID_SECRET);

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(403);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 403 when ENABLE_DEBUG_ENDPOINT is not exactly 'true'", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "1");
    vi.stubEnv("DEBUG_SECRET", VALID_SECRET);

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(403);
  });

  // ── gate 2: DEBUG_SECRET must be configured ─────────────────────────────

  it("returns 403 when DEBUG_SECRET is not configured — regression for #1816", async () => {
    // ENABLE_DEBUG_ENDPOINT=true but no DEBUG_SECRET → must fail closed,
    // not serve diagnostic data.
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "true");
    vi.stubEnv("DEBUG_SECRET", "");

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer anything`));

    expect(res.status).toBe(403);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // ── gate 3: bearer token validation ────────────────────────────────────

  it("returns 401 when no Authorization header is supplied — regression for #1816", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "true");
    vi.stubEnv("DEBUG_SECRET", VALID_SECRET);

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest()); // no header

    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong secret", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "true");
    vi.stubEnv("DEBUG_SECRET", VALID_SECRET);

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest("Bearer wrong-secret"));

    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 for a non-Bearer scheme", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "true");
    vi.stubEnv("DEBUG_SECRET", VALID_SECRET);

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Basic ${VALID_SECRET}`));

    expect(res.status).toBe(401);
  });

  // ── authorised access ────────────────────────────────────────────────────

  it("returns 200 with the correct Bearer token", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "true");
    vi.stubEnv("DEBUG_SECRET", VALID_SECRET);

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });
});

describe("GET /api/debug/health — information disclosure prevention (#1816)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "true");
    vi.stubEnv("DEBUG_SECRET", VALID_SECRET);
    mocks.getServerSession.mockResolvedValue(null);
    stubHealthyDb();
  });

  // ── secret presence indicators must never be exposed ───────────────────

  it("never returns secret-presence indicators — regression for #1816", async () => {
    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    const serialised = JSON.stringify(body);

    // These field names must not appear in any form
    expect(serialised).not.toContain("nextAuthSecret");
    expect(serialised).not.toContain("githubSecret");
    expect(serialised).not.toContain("supabaseServiceRoleKey");
    expect(serialised).not.toContain("NEXTAUTH_SECRET");
    expect(serialised).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialised).not.toContain("GITHUB_SECRET");
    // The "environment" object must not appear at all
    expect(body).not.toHaveProperty("environment");
  });

  it("never returns 'set' or 'missing' secret indicators", async () => {
    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    const serialised = JSON.stringify(body);

    // These are the exact values the old code returned for secret presence
    // — they must no longer appear anywhere in the response.
    expect(serialised).not.toContain('"set"');
    expect(serialised).not.toContain('"missing"');
  });

  // ── session identifiers must never be exposed ──────────────────────────

  it("never exposes githubId — regression for #1816", async () => {
    mocks.getServerSession.mockResolvedValue({
      githubId: "12345678",
      githubLogin: "alice",
    });

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    const serialised = JSON.stringify(body);

    expect(serialised).not.toContain("12345678");
    expect(serialised).not.toContain("githubId");
  });

  it("never exposes githubLogin — regression for #1816", async () => {
    mocks.getServerSession.mockResolvedValue({
      githubId: "12345678",
      githubLogin: "alice",
    });

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    const serialised = JSON.stringify(body);

    expect(serialised).not.toContain("alice");
    expect(serialised).not.toContain("githubLogin");
  });

  // ── session state reported as boolean only ──────────────────────────────

  it("reports authenticated:true when a session exists, without identifiers", async () => {
    mocks.getServerSession.mockResolvedValue({
      githubId: "12345678",
      githubLogin: "alice",
    });

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    expect(body.session.authenticated).toBe(true);
    expect(body.session).not.toHaveProperty("githubId");
    expect(body.session).not.toHaveProperty("githubLogin");
  });

  it("reports authenticated:false when no session exists", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    expect(body.session.authenticated).toBe(false);
  });

  // ── database diagnostics remain functional ─────────────────────────────

  it("reports healthy database connectivity", async () => {
    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    expect(body.database.healthy).toBe(true);
    expect(body.database.error).toBeNull();
  });

  it("reports database error when Supabase is unreachable", async () => {
    const limitMock = vi.fn().mockResolvedValue({
      error: { message: "Connection refused" },
    });
    const selectMock = vi.fn().mockReturnValue({ limit: limitMock });
    mocks.supabaseFrom.mockReturnValue({ select: selectMock });

    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();
    expect(body.database.healthy).toBe(false);
    expect(body.database.error).toBe("Connection refused");
  });

  // ── safe response shape ─────────────────────────────────────────────────

  it("response contains only the expected safe fields", async () => {
    const { GET } = await import("@/app/api/debug/health/route");
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    const body = await res.json();

    // These are the only allowed top-level keys
    const allowedKeys = new Set(["status", "timestamp", "database", "session"]);
    const actualKeys = new Set(Object.keys(body));

    for (const key of actualKeys) {
      expect(allowedKeys).toContain(key);
    }

    // Sub-keys
    expect(Object.keys(body.database)).toEqual(
      expect.arrayContaining(["healthy", "error"])
    );
    expect(Object.keys(body.session)).toEqual(["authenticated"]);
  });
});
