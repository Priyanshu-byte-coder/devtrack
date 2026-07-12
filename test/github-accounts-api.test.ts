import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/user/github-accounts/route";
import { DELETE } from "@/app/api/user/github-accounts/[githubId]/route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { resolveAppUser } from "@/lib/resolve-user";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));

// Mock resolve-user
vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: vi.fn(),
}));

// Mock Supabase admin client methods
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => {
  return {
    select: mockSelect,
    delete: mockDelete,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

describe("GitHub Accounts API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain for GET
    mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({
        order: mockOrder.mockResolvedValue({
          data: [
            { id: "account-1", github_id: "999", github_login: "linked-user", added_at: "2026-05-28T00:00:00Z" }
          ],
          error: null,
        }),
      }),
    });

    // Default chain for DELETE
    mockDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ github_id: "999" }],
            error: null,
          }),
        }),
      }),
    });

    // Default session resolution
    (getServerSession as any).mockResolvedValue({
      githubId: "12345",
      githubLogin: "primary-user",
    });

    (resolveAppUser as any).mockResolvedValue({
      id: "user-uuid-123",
      github_id: "12345",
      github_login: "primary-user",
    });
  });

  describe("GET /api/user/github-accounts", () => {
    it("returns 401 when user is not authenticated", async () => {
      (getServerSession as any).mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when authenticated session user is not found in database", async () => {
      (resolveAppUser as any).mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 500 when database fetch fails", async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: "Database Error" } });

      const res = await GET();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to fetch accounts" });
    });

    it("successfully fetches linked accounts", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        accounts: [
          {
            id: "account-1",
            githubId: "999",
            githubLogin: "linked-user",
            addedAt: "2026-05-28T00:00:00Z",
          }
        ]
      });
    });
  });

  describe("DELETE /api/user/github-accounts/[githubId]", () => {
    it("returns 401 when user is not authenticated", async () => {
      (getServerSession as any).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/user/github-accounts/999", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: "999"  }) });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when githubId parameter is empty", async () => {
      const req = new NextRequest("http://localhost/api/user/github-accounts/ ", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: ""  }) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid githubId parameter" });
    });

    it("returns 400 when githubId parameter is non-numeric", async () => {
      const req = new NextRequest("http://localhost/api/user/github-accounts/abc", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: "abc"  }) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid githubId parameter" });
    });

    it("returns 400 when githubId parameter has spaces or special characters", async () => {
      const req = new NextRequest("http://localhost/api/user/github-accounts/ 123", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: " 123 "  }) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid githubId parameter" });
    });

    it("returns 401 when authenticated session user is not found in database", async () => {
      (resolveAppUser as any).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/user/github-accounts/999", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: "999"  }) });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("returns 400 when trying to remove the primary account", async () => {
      const req = new NextRequest("http://localhost/api/user/github-accounts/12345", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: "12345"  }) });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Cannot remove primary account" });
    });

    it("returns 500 when database deletion query fails", async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database failure" },
            }),
          }),
        }),
      });

      const req = new NextRequest("http://localhost/api/user/github-accounts/999", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: "999"  }) });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Delete failed" });
    });

    it("returns 404 when the account to delete is not found", async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const req = new NextRequest("http://localhost/api/user/github-accounts/999", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: "999"  }) });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Account not found" });
    });

    it("successfully deletes the secondary linked account", async () => {
      const req = new NextRequest("http://localhost/api/user/github-accounts/999", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ githubId: "999"  }) });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    });
  });
});
