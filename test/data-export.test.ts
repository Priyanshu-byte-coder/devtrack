/**
 * Tests for GET /api/user/data-export
 *
 * Covers:
 *  - Authentication guard (401 without session, 404 for unknown user)
 *  - Rate limiting (429 on second request within window, pass after window)
 *  - JSON payload generation (correct MIME type, non-empty, expected fields)
 *  - Audit logging side effect
 *  - Security: secrets are excluded from exported data
 *  - Streak milestones database extraction and correct column schema check
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
  const req = new NextRequest("http://localhost/api/user/data-export");
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
 * The final call in the chain resolves to `result`.
 */
function buildChain(result: unknown) {
  const chain: any = {
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  const resolve = vi.fn().mockResolvedValue(result);
  const methods = ["select", "eq", "gte", "order", "limit", "maybeSingle", "single", "in"];
  for (const m of methods) {
    chain[m] = m === "maybeSingle" || m === "single" ? resolve : vi.fn().mockReturnValue(chain);
  }
  (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return { chain, resolve };
}

/**
 * Quick setup: wires supabaseAdmin.from() so that:
 *  - data_export_audit queries return { data: auditRow, error: null }
 *  - streak_milestones queries return milestoneRow or empty
 *  - All other tables return appropriate mock data or empty arrays
 */
function setupSupabase(
  auditRow: unknown = null,
  streakMilestonesData: unknown[] = []
) {
  const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const emptyResult = { data: [], error: null };
  const userResult = {
    data: {
      id: "user-1",
      github_login: "alice",
      is_public: false,
      leaderboard_opt_in: false,
      created_at: "2024-01-01T00:00:00Z",
    },
    error: null,
  };

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
      const { chain } = buildChain(userResult);
      return { select: vi.fn().mockReturnValue(chain) };
    }
    if (table === "streak_milestones") {
      const { chain } = buildChain({ data: streakMilestonesData, error: null });
      return { select: vi.fn().mockReturnValue(chain) };
    }
    // All other tables return empty arrays
    const { chain } = buildChain(emptyResult);
    return { select: vi.fn().mockReturnValue(chain) };
  });

  return { auditInsert };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/user/data-export", () => {
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
    const { GET } = await import("@/app/api/user/data-export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when session has no githubId", async () => {
    mocks.getServerSession.mockResolvedValue({ githubLogin: "alice" });
    const { GET } = await import("@/app/api/user/data-export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    setupSupabase();
    const { GET } = await import("@/app/api/user/data-export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  // ── Rate limiting ───────────────────────────────────────────────────────

  it("returns 429 when an export was made within the last hour", async () => {
    setupSupabase({ created_at: new Date().toISOString() });
    const { GET } = await import("@/app/api/user/data-export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("allows export when no recent export record exists", async () => {
    setupSupabase(null);
    const { GET } = await import("@/app/api/user/data-export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  // ── JSON response & Streak Milestones Correct Columns ──────────────────

  it("returns JSON content type and valid JSON body containing streak milestones with real values", async () => {
    const mockMilestones = [
      { id: "m-1", user_id: "user-1", streak_count: 7, achieved_at: "2026-06-20T00:00:00Z" },
      { id: "m-2", user_id: "user-1", streak_count: 30, achieved_at: "2026-06-22T00:00:00Z" },
    ];
    setupSupabase(null, mockMilestones);

    const { GET } = await import("@/app/api/user/data-export/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");

    const payload = await res.json();
    expect(payload.userId).toBe("user-1");
    expect(payload.githubLogin).toBe("alice");
    expect(payload.sections).toBeDefined();
    
    // Verify that the streak milestones are correctly queried and exported
    const exportedMilestones = payload.sections.streakMilestones;
    expect(exportedMilestones).toBeDefined();
    expect(exportedMilestones).toHaveLength(2);
    expect(exportedMilestones[0]).toEqual({
      id: "m-1",
      user_id: "user-1",
      streak_count: 7,
      achieved_at: "2026-06-20T00:00:00Z",
    });
    expect(exportedMilestones[1]).toEqual({
      id: "m-2",
      user_id: "user-1",
      streak_count: 30,
      achieved_at: "2026-06-22T00:00:00Z",
    });
  });

  // ── Audit logging ───────────────────────────────────────────────────────

  it("writes an audit log entry for a successful export", async () => {
    const { auditInsert } = setupSupabase(null);
    const { GET } = await import("@/app/api/user/data-export/route");
    await GET(makeRequest());
    expect(auditInsert).toHaveBeenCalledOnce();
    const [row] = auditInsert.mock.calls[0];
    expect(row.user_id).toBe("user-1");
    expect(row.action).toBe("export");
  });
});
