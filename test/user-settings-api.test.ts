import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/user/settings/route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { encryptToken } from "@/lib/crypto";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock resolve-user
vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: vi.fn(),
}));

// Mock crypto
vi.mock("@/lib/crypto", () => ({
  encryptToken: vi
    .fn()
    .mockReturnValue({ encrypted: "encrypted-val", iv: "iv-val" }),
}));

// Mock Supabase admin client methods
const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockUpdate = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => {
  return {
    select: mockSelect,
    update: mockUpdate,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

// GET caches its response for 5 minutes in a module-level store. Left real, the
// first test to run would populate it and every later test would be served that
// payload instead of hitting the mocked database.
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheDelete = vi.fn();
vi.mock("@/lib/metrics-cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDelete: (...args: unknown[]) => mockCacheDelete(...args),
}));

describe("User Settings API Endpoints", () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: clearAllMocks only wipes call history,
    // so a mockResolvedValue set inside one test leaks into the next and the
    // defaults configured below never take effect. Every mock therefore has to
    // be (re)wired here rather than once at module scope.
    vi.resetAllMocks();

    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }));
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheDelete.mockResolvedValue(undefined);
    (encryptToken as any).mockReturnValue({
      encrypted: "encrypted-val",
      iv: "iv-val",
    });

    // Default mock data returned from database select
    mockSingle.mockResolvedValue({
      data: {
        id: "user-uuid-123",
        github_login: "test-user",
        is_public: true,
        public_since: null,
        show_weekly_goals: false,
        leaderboard_opt_in: true,
        pinned_repos: ["repo-1"],
        wakatime_api_key_encrypted: "encrypted-key",
        wakatime_api_key_iv: "iv",
        weekly_digest_opt_in: false,
        discord_webhook_url: null,
        timezone: "UTC",
        preferred_locale: "en",
      },
      error: null,
    });

    // Default select/eq chain
    mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({
        single: mockSingle,
      }),
    });

    // Default mock implementation for database updates
    mockUpdate.mockImplementation((updatesObj: any) => {
      return {
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "user-uuid-123",
                github_login: "test-user",
                is_public:
                  updatesObj.is_public !== undefined
                    ? updatesObj.is_public
                    : true,
                leaderboard_opt_in:
                  updatesObj.leaderboard_opt_in !== undefined
                    ? updatesObj.leaderboard_opt_in
                    : true,
                pinned_repos:
                  updatesObj.pinned_repos !== undefined
                    ? updatesObj.pinned_repos
                    : ["repo-1"],
                wakatime_api_key_encrypted:
                  updatesObj.wakatime_api_key_encrypted !== undefined
                    ? updatesObj.wakatime_api_key_encrypted
                    : "encrypted-key",
                wakatime_api_key_iv:
                  updatesObj.wakatime_api_key_iv !== undefined
                    ? updatesObj.wakatime_api_key_iv
                    : "iv",
                weekly_digest_opt_in:
                  updatesObj.weekly_digest_opt_in !== undefined
                    ? updatesObj.weekly_digest_opt_in
                    : false,
                discord_webhook_url:
                  updatesObj.discord_webhook_url !== undefined
                    ? updatesObj.discord_webhook_url
                    : null,
                timezone:
                  updatesObj.timezone !== undefined
                    ? updatesObj.timezone
                    : "UTC",
                public_since:
                  updatesObj.public_since !== undefined
                    ? updatesObj.public_since
                    : null,
                show_weekly_goals:
                  updatesObj.show_weekly_goals !== undefined
                    ? updatesObj.show_weekly_goals
                    : false,
                preferred_locale:
                  updatesObj.preferred_locale !== undefined
                    ? updatesObj.preferred_locale
                    : "en",
              },
              error: null,
            }),
          }),
        }),
      };
    });

    // Default session and user resolution
    (getServerSession as any).mockResolvedValue({
      githubId: "12345",
      githubLogin: "test-user",
    });

    (resolveAppUser as any).mockResolvedValue({
      id: "user-uuid-123",
      github_id: "12345",
      github_login: "test-user",
    });
  });

  describe("GET /api/user/settings", () => {
    it("returns 401 when user is not authenticated", async () => {
      (getServerSession as any).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/user/settings");
      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 500 when resolving user fails", async () => {
      (resolveAppUser as any).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/user/settings");
      const res = await GET(req);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Failed to fetch user settings",
      });
    });

    it("degrades to safe defaults when every settings column query fails", async () => {
      // fetchUserSettings tries three progressively smaller column sets so a
      // self-hosted deployment on an older migration still works. When all
      // three fail it returns defaults rather than an error.
      // Once per column-set attempt, so the override cannot leak into the next
      // test the way a plain mockResolvedValue would.
      const dbError = { data: null, error: { message: "DB Error" } };
      mockSingle
        .mockResolvedValueOnce(dbError)
        .mockResolvedValueOnce(dbError)
        .mockResolvedValueOnce(dbError);

      const req = new NextRequest("http://localhost/api/user/settings");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.is_public).toBe(false);
      expect(body.leaderboard_opt_in).toBe(false);
      expect(body.pinned_repos).toEqual([]);
    });

    it("successfully retrieves user settings", async () => {
      const req = new NextRequest("http://localhost/api/user/settings");
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        id: "user-uuid-123",
        github_login: "test-user",
        is_public: true,
        public_since: null,
        show_weekly_goals: false,
        leaderboard_opt_in: true,
        weekly_digest_opt_in: false,
        pinned_repos: ["repo-1"],
        has_wakatime_key: true,
        discord_webhook_url: null,
        webhook_url: null,
        timezone: "UTC",
        bio: "",
        discord_muted_until: null,
        preferred_locale: "en",
        public_widgets: ["streak", "contributions"],
      });
    });
  });

  describe("PATCH /api/user/settings", () => {
    it("returns 401 when user is not authenticated", async () => {
      (getServerSession as any).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ is_public: false }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 404 when user is not found in database", async () => {
      (resolveAppUser as any).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ is_public: false }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "User not found" });
    });

    it("returns 400 when request body is invalid JSON", async () => {
      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: "invalid-json",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid request body" });
    });

    it("returns 500 when persisting the settings update fails", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "DB Error" } }),
      });

      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ is_public: false }),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to update settings" });
    });

    it("returns 400 when pinning more than 3 repositories", async () => {
      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({
          pinned_repos: ["repo-1", "repo-2", "repo-3", "repo-4"],
        }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Maximum 3 pins allowed" });
    });

    it("ignores null settings values (treated as field omission) and does not update database", async () => {
      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({
          is_public: null,
          leaderboard_opt_in: null,
          pinned_repos: null,
        }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(200);

      // Verify returned value contains existing fields unchanged
      expect(await res.json()).toEqual({
        id: "user-uuid-123",
        github_login: "test-user",
        is_public: true,
        public_since: null,
        show_weekly_goals: false,
        leaderboard_opt_in: true,
        weekly_digest_opt_in: false,
        pinned_repos: ["repo-1"],
        has_wakatime_key: true,
        discord_webhook_url: null,
        webhook_url: null,
        timezone: "UTC",
        bio: "",
        discord_muted_until: null,
        preferred_locale: "en",
        public_widgets: ["streak", "contributions"],
      });

      // Verify that no database updates were triggered (mockUpdate not called because updates is empty)
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("applies updates when valid fields are supplied in PATCH body", async () => {
      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({
          is_public: false,
          pinned_repos: ["repo-2", "repo-3"],
        }),
      });
      const res = await PATCH(req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        id: "user-uuid-123",
        github_login: "test-user",
        is_public: false,
        public_since: null,
        show_weekly_goals: false,
        leaderboard_opt_in: true,
        weekly_digest_opt_in: false,
        pinned_repos: ["repo-2", "repo-3"],
        has_wakatime_key: true,
        discord_webhook_url: null,
        webhook_url: null,
        timezone: "UTC",
        bio: "",
        discord_muted_until: null,
        preferred_locale: "en",
        public_widgets: ["streak", "contributions"],
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        is_public: false,
        public_since: null,
        pinned_repos: ["repo-2", "repo-3"],
      });
    });

    it("persists preferred locale and sets the locale cookie", async () => {
      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ preferred_locale: "es" }),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ preferred_locale: "es" });
      expect(res.headers.get("set-cookie")).toContain("devtrack-locale=es");
      expect(mockUpdate).toHaveBeenCalledWith({ preferred_locale: "es" });
    });

    it("rejects unsupported locales", async () => {
      const req = new NextRequest("http://localhost/api/user/settings", {
        method: "PATCH",
        body: JSON.stringify({ preferred_locale: "fr" }),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Unsupported locale" });
    });
  });
});
