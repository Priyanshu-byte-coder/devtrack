import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/metrics/repos/route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { getAccountToken } from "@/lib/github-accounts";
import { supabaseAdmin } from "@/lib/supabase";

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

// Mock github-accounts
vi.mock("@/lib/github-accounts", () => ({
  getAccountToken: vi.fn(),
  getAllAccounts: vi.fn(),
  mergeMetrics: vi.fn(),
}));

// Mock Supabase admin client
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
  isSupabaseAdminAvailable: true,
}));

describe("Repos Metrics API Endpoint - DB Failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 502 when supabaseAdmin query throws error during linked account lookup", async () => {
    // 1. Mock valid authenticated session
    (getServerSession as any).mockResolvedValue({
      accessToken: "primary-token",
      githubId: "primary-id",
      githubLogin: "primary-login",
    });

    // 2. Mock resolved app user in resolveAppUser
    (resolveAppUser as any).mockResolvedValue({
      id: "user-uuid-123",
      github_id: "primary-id",
      github_login: "primary-login",
    });

    // 3. Mock getAccountToken to return a token (so it passes the first check)
    (getAccountToken as any).mockResolvedValue("linked-account-token");

    // 4. Mock supabaseAdmin.from to throw an error (simulating database failure or missing client)
    (supabaseAdmin.from as any).mockImplementation(() => {
      throw new Error("Supabase admin client is unavailable.");
    });

    // 5. Build request calling the API with a linked accountId
    const req = new NextRequest("http://localhost/api/metrics/repos?accountId=linked-id");
    const res = await GET(req);

    // 6. Verify it returns 502 instead of throwing an unhandled exception (which would result in a 500)
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "GitHub API error" });
  });

  it("returns 502 when getAccountToken throws error during linked account lookup", async () => {
    // 1. Mock valid authenticated session
    (getServerSession as any).mockResolvedValue({
      accessToken: "primary-token",
      githubId: "primary-id",
      githubLogin: "primary-login",
    });

    // 2. Mock resolved app user in resolveAppUser
    (resolveAppUser as any).mockResolvedValue({
      id: "user-uuid-123",
      github_id: "primary-id",
      github_login: "primary-login",
    });

    // 3. Mock getAccountToken to throw an error
    (getAccountToken as any).mockImplementation(() => {
      throw new Error("Supabase admin client is unavailable.");
    });

    // 5. Build request calling the API with a linked accountId
    const req = new NextRequest("http://localhost/api/metrics/repos?accountId=linked-id");
    const res = await GET(req);

    // 6. Verify it returns 502 instead of throwing an unhandled exception (which would result in a 500)
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "GitHub API error" });
  });
});
