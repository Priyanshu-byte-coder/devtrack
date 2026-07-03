import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: vi.fn() }));

import { getSessionWithToken } from "@/lib/get-session-token";
import { getServerSession } from "next-auth";
import { resolveAppUser } from "@/lib/resolve-user";

const mockGetServerSession = getServerSession as ReturnType<typeof vi.fn>;
const mockResolveAppUser = resolveAppUser as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); });

function makeSession(overrides: Partial<Session> = {}): Session {
  return { user: { name: "Test User", email: "test@example.com", image: null }, expires: "2026-12-31", ...overrides } as Session;
}

describe("getSessionWithToken", () => {
  it("returns null when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    expect(await getSessionWithToken()).toBeNull();
  });

  it("returns null when session lacks githubId", async () => {
    mockGetServerSession.mockResolvedValue(makeSession({ githubId: undefined }));
    expect(await getSessionWithToken()).toBeNull();
  });

  it("returns null when session lacks githubLogin", async () => {
    mockGetServerSession.mockResolvedValue(makeSession({ githubLogin: undefined }));
    expect(await getSessionWithToken()).toBeNull();
  });

  it("returns null when session lacks accessToken", async () => {
    mockGetServerSession.mockResolvedValue(makeSession({ accessToken: undefined }));
    expect(await getSessionWithToken()).toBeNull();
  });

  it("returns null when resolveAppUser returns null", async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    mockResolveAppUser.mockResolvedValue(null);
    expect(await getSessionWithToken()).toBeNull();
  });

  it("returns SessionWithToken with correct shape when all conditions met", async () => {
    const session = makeSession({ accessToken: "ghp_testtoken", githubId: "12345", githubLogin: "testuser" });
    mockGetServerSession.mockResolvedValue(session);
    mockResolveAppUser.mockResolvedValue({ id: "user-id-123", github_login: "testuser" });
    const result = await getSessionWithToken();
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe("ghp_testtoken");
    expect(result!.session).toBe(session);
  });

  it("passes githubId and githubLogin to resolveAppUser", async () => {
    mockGetServerSession.mockResolvedValue(makeSession({ githubId: "12345", githubLogin: "testuser" }));
    mockResolveAppUser.mockResolvedValue({ id: "x", github_login: "testuser" });
    await getSessionWithToken();
    expect(mockResolveAppUser).toHaveBeenCalledWith("12345", "testuser");
  });

  it("returns null when resolveAppUser throws", async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    mockResolveAppUser.mockRejectedValue(new Error("db error"));
    expect(await getSessionWithToken()).toBeNull();
  });
});
