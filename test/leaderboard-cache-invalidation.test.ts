/**
 * Regression tests for leaderboard stale-cache visibility (#1779).
 *
 * Background
 * ----------
 * The leaderboard is cached at two levels:
 *   1. A module-level in-process Map (_memoryCache in leaderboard.ts)
 *   2. A shared Redis/Upstash entry (LEADERBOARD_CACHE_KEY)
 *
 * Before this fix, PATCH /api/user/settings persisted is_public and
 * leaderboard_opt_in changes to the database but did not invalidate
 * either cache layer. A user who opted out remained visible on the
 * leaderboard for up to one hour. A user who opted in was invisible
 * for the same duration.
 *
 * Fix
 * ---
 * After a successful PATCH that modifies is_public or leaderboard_opt_in,
 * the settings route now calls clearLeaderboardCache(), which:
 *   - nulls _memoryCache in leaderboard.ts
 *   - deletes the key from the in-process metrics memory Map
 *   - deletes the key from Redis/Upstash
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  clearLeaderboardCache: vi.fn(),
  cacheDelete: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/crypto", () => ({ encryptToken: vi.fn() }));
vi.mock("@/lib/leaderboard", () => ({
  clearLeaderboardCache: mocks.clearLeaderboardCache,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

const DB_USER = {
  id: "user-uuid",
  github_login: "alice",
  is_public: true,
  leaderboard_opt_in: true,
  bio: "",
  pinned_repos: [],
  wakatime_api_key_encrypted: null,
  wakatime_api_key_iv: null,
  weekly_digest_opt_in: false,
  discord_webhook_url: null,
  timezone: "UTC",
};

function setupSupabase(updatedFields: Partial<typeof DB_USER> = {}) {
  const selectSingle = vi.fn().mockResolvedValue({ data: DB_USER, error: null });
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
  const selectChain = vi.fn().mockReturnValue({ eq: selectEq });

  const updateSingle = vi.fn().mockResolvedValue({
    data: { ...DB_USER, ...updatedFields },
    error: null,
  });
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });
  const updateChain = vi.fn().mockReturnValue({ eq: updateEq });

  mocks.supabaseFrom.mockReturnValue({
    select: selectChain,
    update: updateChain,
  });

  return { selectSingle, updateEq, updateChain };
}

function patchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/user/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("PATCH /api/user/settings — leaderboard cache invalidation (#1779)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ githubId: "gh-1", githubLogin: "alice" });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-uuid" });
    mocks.clearLeaderboardCache.mockResolvedValue(undefined);
  });

  // ── is_public changes ─────────────────────────────────────────────────────

  it("clears the leaderboard cache when is_public is set to false — regression for #1779", async () => {
    setupSupabase({ is_public: false });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).toHaveBeenCalledOnce();
  });

  it("clears the leaderboard cache when is_public is set to true", async () => {
    setupSupabase({ is_public: true });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: true }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).toHaveBeenCalledOnce();
  });

  // ── leaderboard_opt_in changes ────────────────────────────────────────────

  it("clears the leaderboard cache when leaderboard_opt_in is set to false — regression for #1779", async () => {
    setupSupabase({ leaderboard_opt_in: false });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ leaderboard_opt_in: false }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).toHaveBeenCalledOnce();
  });

  it("clears the leaderboard cache when leaderboard_opt_in is set to true", async () => {
    setupSupabase({ leaderboard_opt_in: true, is_public: true });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ leaderboard_opt_in: true }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).toHaveBeenCalledOnce();
  });

  it("clears the cache once even when both is_public and leaderboard_opt_in change", async () => {
    setupSupabase({ is_public: false, leaderboard_opt_in: false });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false, leaderboard_opt_in: false }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).toHaveBeenCalledOnce();
  });

  // ── irrelevant changes — cache must NOT be cleared ────────────────────────

  it("does NOT clear the leaderboard cache when only bio changes", async () => {
    setupSupabase({ bio: "New bio" });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ bio: "New bio" }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  });

  it("does NOT clear the leaderboard cache when only timezone changes", async () => {
    setupSupabase({ timezone: "America/New_York" });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ timezone: "America/New_York" }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  });

  it("does NOT clear the leaderboard cache when only weekly_digest_opt_in changes", async () => {
    setupSupabase({ weekly_digest_opt_in: true });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ weekly_digest_opt_in: true }));

    expect(res.status).toBe(200);
    expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  });

  // ── error resilience ──────────────────────────────────────────────────────

  it("still returns 200 when clearLeaderboardCache throws — invalidation is best-effort", async () => {
    mocks.clearLeaderboardCache.mockRejectedValue(new Error("Redis unavailable"));
    setupSupabase({ is_public: false });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false }));

    // The settings update must succeed even if cache invalidation fails.
    expect(res.status).toBe(200);
  });

  // ── 401/404 paths — cache must never be touched ───────────────────────────

  it("does NOT clear the leaderboard cache when the request is unauthenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false }));

    expect(res.status).toBe(401);
    expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  });

  it("does NOT clear the leaderboard cache when the user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false }));

    expect(res.status).toBe(404);
    expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  });
});

