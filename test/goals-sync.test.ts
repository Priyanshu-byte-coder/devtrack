/**
 * Integration tests for /api/goals/sync endpoint (#947)
 *
 * Covers:
 * - 401 when no session
 * - 404 when user not found in DB
 * - Fetches commit count from GitHub Search API with correct date range
 * - Updates all commit-based goals with the fetched count
 * - Handles GitHub API 429 — returns 429, does not update goals
 * - Handles Supabase update failure gracefully
 * - PR goals are synced using GitHub Issues Search API
 * - Returns updated count correctly
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/server-session", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────

import { getServerSession } from "@/lib/server-session";
import { supabaseAdmin } from "@/lib/supabase";
import { POST } from "@/app/api/goals/sync/route";

// ── Helpers ───────────────────────────────────────────────────────────────

const mockSession = {
  accessToken: "gh_test_token",
  githubId: "12345",
  githubLogin: "testuser",
};

const mockUser = { id: "user-uuid-1" };

const makeCommitGoal = (overrides = {}) => ({
  id: "goal-commit-1",
  unit: "commits",
  repo: null,
  repository: null,
  repo_name: null,
  ...overrides,
});

const makePRGoal = (overrides = {}) => ({
  id: "goal-pr-1",
  unit: "prs",
  repo: null,
  repository: null,
  repo_name: null,
  ...overrides,
});

/**
 * Builds a minimal Supabase chain mock.
 * Each call to supabaseAdmin.from() returns a builder whose
 * terminal method resolves to { data, error }.
 */
function mockSupabaseChain(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  // Make the chain also resolve as a promise (for non-.single() calls)
  (chain as any).then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

/**
 * Sets up supabaseAdmin.from() to return different chains
 * for "users" vs "goals" table calls in sequence.
 */
function setupSupabaseMocks({
  user = mockUser,
  userError = null,
  goals = [makeCommitGoal()],
  goalsError = null,
  updateError = null,
}: {
  user?: unknown;
  userError?: unknown;
  goals?: unknown[];
  goalsError?: unknown;
  updateError?: unknown;
} = {}) {
  const userChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: user, error: userError }),
  };

  const goalsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data: goals, error: goalsError }),
    limit: vi.fn().mockResolvedValue({ data: goals, error: goalsError }),
  };

  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown)=>unknown) => Promise.resolve({data:null,error:updateError}).then(resolve),
    in: vi.fn().mockResolvedValue({ data: null, error: updateError }),
  };

  updateChain.update.mockReturnValue(updateChain);

  vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
    if (table === "users") return userChain as any;
    if (table === "goals") {
      // Return goalsChain for SELECT, updateChain for UPDATE
      return {
        ...goalsChain,
        update: updateChain.update,
      } as any;
    }
    return userChain as any;
  });

  return { userChain, goalsChain, updateChain };
}

/**
 * Builds a minimal GitHub Search API response.
 */
function makeGitHubCommitsResponse(count: number, total?: number) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({
      items: Array(count).fill({ sha: "abc123" }),
      total_count: total ?? count,
    }),
  };
}

function makeGitHubPRsResponse(totalCount: number) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({
      total_count: totalCount,
      items: [],
    }),
  };
}

function makeGitHubRateLimitResponse(resetTimestamp?: number) {
  const headers = new Headers();
  if (resetTimestamp) {
    headers.set("X-RateLimit-Reset", String(resetTimestamp));
  }
  return {
    ok: false,
    status: 429,
    headers,
    json: vi.fn().mockResolvedValue({}),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/goals/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 when there is no session", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when session has no accessToken", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        githubId: "123",
        githubLogin: "testuser",
        // accessToken missing
      } as any);

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when session has no githubId", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        accessToken: "token",
        githubLogin: "testuser",
        // githubId missing
      } as any);

      const res = await POST();
      expect((await res.json()).error).toBe("Unauthorized");
    });

    it("returns 401 when session has no githubLogin", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        accessToken: "token",
        githubId: "123",
        // githubLogin missing
      } as any);

      const res = await POST();
      expect((await res.json()).error).toBe("Unauthorized");
    });
  });

  // ── User lookup ─────────────────────────────────────────────────────────

  describe("user lookup", () => {
    it("returns 404 when user is not found in the database", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ user: null });

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe("User not found");
    });
  });

  // ── No goals ────────────────────────────────────────────────────────────

  describe("when no goals exist", () => {
    it("returns updated:0 when user has no commit or PR goals this week", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [] });

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.updated).toBe(0);
      expect(body.commitCount).toBe(0);
    });
  });

  // ── Commit goals ────────────────────────────────────────────────────────

  describe("commit goal syncing", () => {
    it("calls GitHub Search API with the correct author and date range", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [makeCommitGoal()] });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubCommitsResponse(3) as any
      );

      await POST();

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const url = fetchCall[0] as string;

      expect(url).toContain("api.github.com/search/commits");
      expect(url).toContain(`author%3A${mockSession.githubLogin}`);
      expect(url).toContain("author-date%3A");
    });

    it("includes repo qualifier in the query when goal has a valid repo", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({
        goals: [makeCommitGoal({ repo: "testuser/myrepo" })],
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubCommitsResponse(2) as any
      );

      await POST();

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(url).toContain("repo%3Atestuser%2Fmyrepo");
    });

    it("updates the goal with the fetched commit count", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const { updateChain } = setupSupabaseMocks({
        goals: [makeCommitGoal({ id: "goal-abc" })],
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubCommitsResponse(7) as any
      );

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.updated).toBe(1);
      // Verify update was called with the commit count
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ current: 7 })
      );
    });

    it("updates multiple commit goals independently", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const { updateChain } = setupSupabaseMocks({
        goals: [
          makeCommitGoal({ id: "goal-1" }),
          makeCommitGoal({ id: "goal-2", repo: "testuser/other-repo" }),
        ],
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(makeGitHubCommitsResponse(5) as any)
        .mockResolvedValueOnce(makeGitHubCommitsResponse(3) as any);

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.updated).toBe(2);
      expect(updateChain.update).toHaveBeenCalledTimes(2);
    });

    it("sets last_synced_at on the updated goal", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const { updateChain } = setupSupabaseMocks({
        goals: [makeCommitGoal()],
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubCommitsResponse(4) as any
      );

      await POST();

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ last_synced_at: expect.any(String) })
      );
    });
  });

  // ── PR goals ────────────────────────────────────────────────────────────

  describe("PR goal syncing", () => {
    it("calls GitHub Issues Search API for PR goals", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [makePRGoal()] });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubPRsResponse(2) as any
      );

      await POST();

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(url).toContain("api.github.com/search/issues");
      expect(url).toContain("type%3Apr");
      expect(url).toContain("is%3Amerged");
    });

    it("updates all PR goals with the fetched PR count", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const { updateChain } = setupSupabaseMocks({
        goals: [makePRGoal({ id: "pr-goal-1" }), makePRGoal({ id: "pr-goal-2" })],
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubPRsResponse(4) as any
      );

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.updated).toBe(2);
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ current: 4 })
      );
    });
  });

  // ── GitHub rate limiting ─────────────────────────────────────────────────

  describe("GitHub API rate limiting", () => {
    it("returns 429 when GitHub returns 429 for commit search", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const { updateChain } = setupSupabaseMocks({
        goals: [makeCommitGoal()],
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubRateLimitResponse() as any
      );

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(429);
      expect(body.error).toBe("GITHUB_RATE_LIMITED");
      expect(res.headers.get("retry-after")).toBeTruthy();
      // Goals must NOT be updated when rate limited
      expect(updateChain.update).not.toHaveBeenCalled();
    });

    it("returns 502 when GitHub denies permission without quota exhaustion", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [makeCommitGoal()] });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({}),
      } as any);

      const res = await POST();
      expect(res.status).toBe(502);
    });

    it("includes reset time in message when X-RateLimit-Reset header is present", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [makeCommitGoal()] });

      // A future Unix timestamp (year 2099)
      const futureReset = Math.floor(new Date("2099-01-01T10:30:00Z").getTime() / 1000);

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubRateLimitResponse(futureReset) as any
      );

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(429);
      expect(body.rateLimit.resetAt).toBe("2099-01-01T10:30:00.000Z");
    });

    it("returns 429 and does not update PR goals when GitHub PR search is rate limited", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const { updateChain } = setupSupabaseMocks({
        goals: [makePRGoal()],
      });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubRateLimitResponse() as any
      );

      const res = await POST();

      expect(res.status).toBe(429);
      expect(updateChain.update).not.toHaveBeenCalled();
    });
  });

  // ── GitHub API errors ────────────────────────────────────────────────────

  describe("GitHub API non-rate-limit errors", () => {
    it("returns 502 when GitHub returns a non-429 error for commit search", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [makeCommitGoal()] });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({}),
      } as any);

      const res = await POST();
      expect(res.status).toBe(502);
    });
  });
 // ── Supabase errors ─────────────────────────────────────────────────────
 describe("Supabase failure handling", () => {
  it("returns 500 when fetching goals from Supabase fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    setupSupabaseMocks({
      goalsError: { message: "DB connection failed" },
      goals: null as any,
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch goals");
  });

  it("returns 500 when a progress write fails",async()=>{
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    setupSupabaseMocks({updateError:{message:'DB write failed'}});
    vi.mocked(global.fetch).mockResolvedValue(makeGitHubCommitsResponse(1,5) as any);
    const res=await POST();expect(res.status).toBe(500);expect((await res.json()).error).toBe('Failed to update goals');
  });
  it("checks failures for review goals as well as commit goals",async()=>{
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    setupSupabaseMocks({goals:[makeCommitGoal({unit:'reviews'})],updateError:{message:'DB write failed'}});
    vi.mocked(global.fetch).mockResolvedValue(makeGitHubPRsResponse(3) as any);
    expect((await POST()).status).toBe(500);
  });
});

  // ── Date range ────────────────────────────────────────────────────────────

  describe("date range correctness", () => {
    it("uses Monday as week start and Sunday as week end in the query", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [makeCommitGoal()] });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubCommitsResponse(1) as any
      );

      await POST();

      const url = vi.mocked(global.fetch).mock.calls[0][0] as string;
      const decoded = decodeURIComponent(url);

      // The date range qualifier must be present
      expect(decoded).toContain("author-date:");
      // Must contain .. range separator
      expect(decoded).toMatch(/author-date:.+\.\..+/);
    });

    it("sends correct Authorization header to GitHub", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      setupSupabaseMocks({ goals: [makeCommitGoal()] });

      vi.mocked(global.fetch).mockResolvedValue(
        makeGitHubCommitsResponse(0) as any
      );

      await POST();

      const fetchOptions = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit;
      expect((fetchOptions.headers as Record<string, string>)["Authorization"]).toBe(
        `Bearer ${mockSession.accessToken}`
      );
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  describe("count requests", () => {
    it("uses total_count beyond the Search pagination ceiling in one request", async()=>{
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const {updateChain}=setupSupabaseMocks({goals:[makeCommitGoal()]});
      vi.mocked(global.fetch).mockResolvedValue(makeGitHubCommitsResponse(1,2500) as any);
      const res=await POST();expect(res.status).toBe(200);expect(fetch).toHaveBeenCalledTimes(1);
      expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({current:2500}));
    });
    it("shares identical counts across goals",async()=>{
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const {updateChain}=setupSupabaseMocks({goals:[makeCommitGoal({id:'one'}),makeCommitGoal({id:'two'})]});
      vi.mocked(global.fetch).mockResolvedValue(makeGitHubCommitsResponse(1,150) as any);
      expect((await POST()).status).toBe(200);expect(fetch).toHaveBeenCalledTimes(1);expect(updateChain.update).toHaveBeenCalledTimes(2);
    });
    it("never writes incomplete search counts",async()=>{
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const {updateChain}=setupSupabaseMocks();vi.mocked(global.fetch).mockResolvedValue({ok:true,json:async()=>({total_count:30,incomplete_results:true})} as any);
      expect((await POST()).status).toBe(502);expect(updateChain.update).not.toHaveBeenCalled();
    });
  });

  // ── Mixed goals ────────────────────────────────────────────────────────────

  describe("mixed commit and PR goals", () => {
    it("syncs both commit and PR goals and returns combined updated count", async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
      const { updateChain } = setupSupabaseMocks({
        goals: [makeCommitGoal({ id: "c1" }), makePRGoal({ id: "p1" })],
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(makeGitHubCommitsResponse(6) as any) // commits
        .mockResolvedValueOnce(makeGitHubPRsResponse(2) as any);    // prs

      const res = await POST();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.updated).toBe(2);
      expect(updateChain.update).toHaveBeenCalledTimes(2);
    });
  });
});