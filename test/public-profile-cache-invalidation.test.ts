/**
 * Public profile pages cache each user's data for a few minutes. A settings
 * write has to evict that entry, or a user who makes their profile private
 * stays visible until the cache expires.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  invalidatePublicProfile: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/crypto", () => ({ encryptToken: vi.fn() }));
vi.mock("@/lib/leaderboard", () => ({ clearLeaderboardCache: vi.fn() }));
vi.mock("@/lib/public-profile-tags", () => ({
  invalidatePublicProfile: mocks.invalidatePublicProfile,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

const DB_USER = {
  id: "user-uuid",
  github_login: "Alice",
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
  const selectSingle = vi
    .fn()
    .mockResolvedValue({ data: DB_USER, error: null });
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle });
  const updateSingle = vi.fn().mockResolvedValue({
    data: { ...DB_USER, ...updatedFields },
    error: null,
  });
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect });

  mocks.supabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({ eq: selectEq }),
    update: vi.fn().mockReturnValue({ eq: updateEq }),
  });
}

function patchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/user/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/user/settings — public profile cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-1",
      githubLogin: "alice",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-uuid" });
  });

  it("evicts the cached profile when the user makes it private", async () => {
    setupSupabase({ is_public: false });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false }));

    expect(res.status).toBe(200);
    // The stored login is used, so the tag matches what the page cached.
    expect(mocks.invalidatePublicProfile).toHaveBeenCalledWith("Alice");
  });

  it("evicts the cached profile when only the bio changes", async () => {
    setupSupabase({ bio: "new bio" });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ bio: "new bio" }));

    expect(res.status).toBe(200);
    expect(mocks.invalidatePublicProfile).toHaveBeenCalledOnce();
  });

  it("still returns 200 when eviction throws", async () => {
    setupSupabase({ is_public: false });
    mocks.invalidatePublicProfile.mockImplementation(() => {
      throw new Error("cache unavailable");
    });
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false }));

    expect(res.status).toBe(200);
  });

  it("does not evict anything for an unauthenticated request", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/user/settings/route");

    const res = await PATCH(patchRequest({ is_public: false }));

    expect(res.status).toBe(401);
    expect(mocks.invalidatePublicProfile).not.toHaveBeenCalled();
  });
});
