import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/auth", () => ({ authOptions: { secret: "test" } }));

import { authOptions } from "@/lib/auth";
import { getSessionWithToken } from "@/lib/get-session-token";

describe("getSessionWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      githubId: "123",
      githubLogin: "nanda",
      accessToken: "token",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
  });

  it("requires an authenticated session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    await expect(getSessionWithToken()).resolves.toBeNull();
    expect(mocks.resolveAppUser).not.toHaveBeenCalled();
    expect(mocks.getServerSession).toHaveBeenCalledWith(authOptions);
  });

  it.each([
    [{ githubLogin: "nanda", accessToken: "token" }],
    [{ githubId: "123", accessToken: "token" }],
    [{ githubId: "123", githubLogin: "nanda" }],
  ])("rejects incomplete sessions", async (session) => {
    mocks.getServerSession.mockResolvedValue(session);
    await expect(getSessionWithToken()).resolves.toBeNull();
    expect(mocks.resolveAppUser).not.toHaveBeenCalled();
  });

  it("rejects a session whose application user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    await expect(getSessionWithToken()).resolves.toBeNull();
    expect(mocks.resolveAppUser).toHaveBeenCalledWith("123", "nanda");
  });

  it("returns the session and access token for a resolved user", async () => {
    const session = {
      githubId: "123",
      githubLogin: "nanda",
      accessToken: "token",
    };
    mocks.getServerSession.mockResolvedValue(session);
    await expect(getSessionWithToken()).resolves.toEqual({
      session,
      accessToken: "token",
    });
    expect(mocks.resolveAppUser).toHaveBeenCalledWith("123", "nanda");
  });
});
