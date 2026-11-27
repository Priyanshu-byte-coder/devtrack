import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/notifications/route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  supabaseFrom: vi.fn(),
  isSupabaseAdminAvailable: true,
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/supabase", () => ({
  get isSupabaseAdminAvailable() {
    return mocks.isSupabaseAdminAvailable;
  },
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}));

const mockNotificationsData = [
  {
    id: "notif-1",
    type: "pull_request",
    message: "PR #42 was approved by octocat",
    read: false,
    created_at: "2026-05-18T10:00:00Z",
  },
  {
    id: "notif-2",
    type: "streak",
    message: "You reached a 7-day streak!",
    read: true,
    created_at: "2026-05-17T09:00:00Z",
  },
  {
    id: "notif-3",
    type: "issue",
    message: "Issue #100 was closed by maintainer",
    read: false,
    created_at: "2026-05-16T08:00:00Z",
  },
];

interface SupabaseMockOptions {
  userData?: { id: string } | null;
  userError?: { code?: string; message: string } | null;
  notificationsData?: any[] | null;
  notificationsError?: { message: string } | null;
  patchError?: { message: string } | null;
  deleteError?: { message: string } | null;
}

function setupSupabase({
  userData = { id: "user-uuid-1" },
  userError = null,
  notificationsData = mockNotificationsData,
  notificationsError = null,
  patchError = null,
  deleteError = null,
}: SupabaseMockOptions = {}) {
  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: userData,
              error: userError,
            }),
          }),
        }),
      };
    }

    if (table === "notifications") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: notificationsData,
                error: notificationsError,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: patchError,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: deleteError,
          }),
        }),
      };
    }

    return {};
  });
}

describe("/api/notifications route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseAdminAvailable = true;
    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-12345",
      user: { name: "Test User" },
    });
    setupSupabase();
  });

  describe("GET /api/notifications", () => {
    it("returns 401 when there is no authenticated session", async () => {
      mocks.getServerSession.mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no githubId", async () => {
      mocks.getServerSession.mockResolvedValue({
        user: { name: "No GitHub ID" },
      });

      const res = await GET();
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns empty notifications when supabaseAdmin is unavailable", async () => {
      mocks.isSupabaseAdminAvailable = false;

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ notifications: [], unreadCount: 0 });
    });

    it("returns empty notifications when user is not found in database", async () => {
      setupSupabase({
        userData: null,
        userError: { code: "PGRST116", message: "No rows returned" },
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ notifications: [], unreadCount: 0 });
    });

    it("returns 500 when Supabase notifications query fails", async () => {
      setupSupabase({
        notificationsError: { message: "Database connection failed" },
      });

      const res = await GET();
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: "Failed to fetch notifications" });
    });

    it("returns 200 with notification list and calculated unreadCount on success", async () => {
      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.notifications).toEqual(mockNotificationsData);
      // 2 unread out of 3 in mockNotificationsData
      expect(body.unreadCount).toBe(2);
    });

    it("handles null notification list gracefully", async () => {
      setupSupabase({ notificationsData: null });

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ notifications: [], unreadCount: 0 });
    });

    it("catches unexpected exceptions and returns 500", async () => {
      mocks.getServerSession.mockRejectedValue(new Error("Unexpected crash"));

      const res = await GET();
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: "Internal server error" });
    });
  });

  describe("PATCH /api/notifications", () => {
    it("returns 401 when there is no authenticated session", async () => {
      mocks.getServerSession.mockResolvedValue(null);

      const res = await PATCH();
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no githubId", async () => {
      mocks.getServerSession.mockResolvedValue({
        user: { name: "No GitHub ID" },
      });

      const res = await PATCH();
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns success: true when user is not found in database", async () => {
      setupSupabase({
        userData: null,
        userError: { code: "PGRST116", message: "No rows returned" },
      });

      const res = await PATCH();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("returns 500 when Supabase update fails", async () => {
      setupSupabase({
        patchError: { message: "Database update error" },
      });

      const res = await PATCH();
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: "Failed to update notifications" });
    });

    it("returns 200 with success: true when mark as read succeeds", async () => {
      const res = await PATCH();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("catches unexpected exceptions and returns 500", async () => {
      mocks.getServerSession.mockRejectedValue(new Error("Unexpected crash"));

      const res = await PATCH();
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: "Internal server error" });
    });
  });

  describe("DELETE /api/notifications", () => {
    it("returns 401 when there is no authenticated session", async () => {
      mocks.getServerSession.mockResolvedValue(null);

      const res = await DELETE();
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no githubId", async () => {
      mocks.getServerSession.mockResolvedValue({
        user: { name: "No GitHub ID" },
      });

      const res = await DELETE();
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns success: true when user is not found in database", async () => {
      setupSupabase({
        userData: null,
        userError: { code: "PGRST116", message: "No rows returned" },
      });

      const res = await DELETE();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("returns 500 when Supabase delete fails", async () => {
      setupSupabase({
        deleteError: { message: "Database delete error" },
      });

      const res = await DELETE();
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: "Failed to delete notifications" });
    });

    it("returns 200 with success: true when clearing notifications succeeds", async () => {
      const res = await DELETE();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ success: true });
    });

    it("catches unexpected exceptions and returns 500", async () => {
      mocks.getServerSession.mockRejectedValue(new Error("Unexpected crash"));

      const res = await DELETE();
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({ error: "Internal server error" });
    });
  });
});
