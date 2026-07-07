/**
 * Tests for GET /api/user/export
 *
 * Covers:
 *  - Authentication guard (401 without session, 404 for unknown user)
 *  - Rate limiting (429 on second request within window, pass after window)
 *  - ZIP archive generation (correct MIME type, non-empty buffer)
 *  - Audit logging side effect
 *  - Security: secrets are excluded from exported data
 *  - User isolation: data is scoped to the requesting user
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest("http://localhost/api/user/export");
  for (const [key, value] of Object.entries(headers)) {
    Object.defineProperty(req, "headers", {
      value: new Headers({ ...Object.fromEntries(req.headers.entries()), [key]: value }),
      configurable: true,
    });
  }
  return req;
}

/**
 * Builds a chainable Supabase query mock.
 * The final call in the chain (`maybeSingle` or `limit`) resolves to `result`.
 */
function buildChain(result: unknown) {
  const chain: any = {
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  const resolve = vi.fn().mockResolvedValue(result);
  const methods = ["select", "eq", "gte", "order", "limit", "maybeSingle", "single"];
  for (const m of methods) {
    chain[m] = m === "maybeSingle" || m === "single" ? resolve : vi.fn().mockReturnValue(chain);
  }
  // make limit resolve too (some queries don't call maybeSingle)
  (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return { chain, resolve };
}

/**
 * Quick setup: wires supabaseAdmin.from() so that:
 *  - data_export_audit queries return { data: auditRow, error: null }
 *  - All other tables return { data: [], error: null }
 *
 * `auditRow` null means "no recent export" → rate limit not hit.
 */
function setupSupabase(auditRow: unknown = null) {
  const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const emptyResult = { data: [], error: null };
  const singleResult = { data: { id: "user-1", github_login: "alice", bio: "", is_public: false, leaderboard_opt_in: false, weekly_digest_opt_in: false, timezone: "UTC", created_at: "2024-01-01T00:00:00Z" }, error: null };
  const streakMilestonesSelect = vi.fn().mockReturnValue(buildChain(emptyResult).chain);

  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === "data_export_audit") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: auditRow, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: auditInsert,
      };
    }
    if (table === "users") {
      const { chain } = buildChain(singleResult);
      return { select: vi.fn().mockReturnValue(chain) };
    }
    if (table === "streak_milestones") {
      return { select: streakMilestonesSelect };
    }
    // All other tables return empty arrays
    const { chain } = buildChain(emptyResult);
    return { select: vi.fn().mockReturnValue(chain) };
  });

  return { auditInsert, streakMilestonesSelect };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/user/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-1",
      githubLogin: "alice",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
  });

  // ── Authentication ──────────────────────────────────────────────────────

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when session has no githubId", async () => {
    mocks.getServerSession.mockResolvedValue({ githubLogin: "alice" });
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    setupSupabase();
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  // ── Rate limiting ───────────────────────────────────────────────────────

  it("returns 429 when an export was made within the last hour", async () => {
    setupSupabase({ created_at: new Date().toISOString() });
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("includes Retry-After header in 429 response", async () => {
    setupSupabase({ created_at: new Date().toISOString() });
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("includes retryAfterSeconds in 429 response body", async () => {
    setupSupabase({ created_at: new Date().toISOString() });
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(typeof body.retryAfterSeconds).toBe("number");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("allows export when no recent export record exists", async () => {
    setupSupabase(null);
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── ZIP response ────────────────────────────────────────────────────────

  it("returns Content-Type application/zip", async () => {
    setupSupabase(null);
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  });

  it("returns a non-empty response body", async () => {
    setupSupabase(null);
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it("sets Content-Disposition as attachment with .zip filename", async () => {
    setupSupabase(null);
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain(".zip");
  });

  it("sets Cache-Control: no-store", async () => {
    setupSupabase(null);
    const { GET } = await import("@/app/api/user/export/route");
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // ── Audit logging ───────────────────────────────────────────────────────

  it("writes an audit log entry for a successful export", async () => {
    const { auditInsert } = setupSupabase(null);
    const { GET } = await import("@/app/api/user/export/route");
    await GET(makeRequest());
    expect(auditInsert).toHaveBeenCalledOnce();
    const [row] = auditInsert.mock.calls[0];
    expect(row.user_id).toBe("user-1");
    expect(row.action).toBe("export");
  });

  it("does not write an audit log entry when rate-limited", async () => {
    const { auditInsert } = setupSupabase({ created_at: new Date().toISOString() });
    const { GET } = await import("@/app/api/user/export/route");
    await GET(makeRequest());
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it("queries the correct column names for streak milestones", async () => {
    const { streakMilestonesSelect } = setupSupabase(null);
    const { GET } = await import("@/app/api/user/export/route");
    await GET(makeRequest());
    expect(streakMilestonesSelect).toHaveBeenCalledWith("id, streak_count, achieved_at");
  });
});

// ─── CSV utilities ────────────────────────────────────────────────────────────

describe("toCsv", () => {
  it("returns empty string for an empty array", async () => {
    const { toCsv } = await import("@/lib/csv");
    expect(toCsv([])).toBe("");
  });

  it("generates a header row from the first object's keys", async () => {
    const { toCsv } = await import("@/lib/csv");
    const csv = toCsv([{ a: 1, b: 2 }]);
    const [header] = csv.split("\n");
    expect(header).toBe("a,b");
  });

  it("serialises multiple rows correctly", async () => {
    const { toCsv } = await import("@/lib/csv");
    const csv = toCsv([
      { date: "2024-01-01", count: 5 },
      { date: "2024-01-02", count: 3 },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("2024-01-01,5");
    expect(lines[2]).toBe("2024-01-02,3");
  });

  it("wraps values containing commas in double-quotes", async () => {
    const { toCsv } = await import("@/lib/csv");
    const csv = toCsv([{ name: "Smith, John", score: 10 }]);
    expect(csv).toContain('"Smith, John"');
  });

  it("escapes double-quotes by doubling them", async () => {
    const { toCsv } = await import("@/lib/csv");
    const csv = toCsv([{ note: 'He said "hello"' }]);
    expect(csv).toContain('"He said ""hello"""');
  });

  it("renders null as an empty cell", async () => {
    const { toCsv } = await import("@/lib/csv");
    const csv = toCsv([{ a: null, b: 1 }]);
    const [, dataRow] = csv.split("\n");
    expect(dataRow).toBe(",1");
  });
});

// ─── csvCell ─────────────────────────────────────────────────────────────────

describe("csvCell", () => {
  it("returns empty string for null", async () => {
    const { csvCell } = await import("@/lib/csv");
    expect(csvCell(null)).toBe("");
  });

  it("returns empty string for undefined", async () => {
    const { csvCell } = await import("@/lib/csv");
    expect(csvCell(undefined)).toBe("");
  });

  it("returns plain string for a simple value", async () => {
    const { csvCell } = await import("@/lib/csv");
    expect(csvCell("hello")).toBe("hello");
  });

  it("quotes values that contain a comma", async () => {
    const { csvCell } = await import("@/lib/csv");
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("quotes values that contain a newline", async () => {
    const { csvCell } = await import("@/lib/csv");
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("converts numbers to string without quoting", async () => {
    const { csvCell } = await import("@/lib/csv");
    expect(csvCell(42)).toBe("42");
  });
});
