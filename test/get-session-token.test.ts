import { describe, it, expect, beforeEach, vi } from "vitest";

// "server-only" throws outside a server context, so it must be stubbed for tests
vi.mock("server-only", () => ({}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { getSessionWithToken } from "../src/lib/get-session-token";

describe("getSessionWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no session", async () => {
    (getServerSession as any).mockResolvedValue(null);

    const result = await getSessionWithToken();

    expect(result).toBeNull();
  });

  it("returns null when session is missing githubId", async () => {
    (getServerSession as any).mockResolvedValue({
      githubLogin: "octocat",
      accessToken: "token-123",
    });

    const result = await getSessionWithToken();

    expect(result).toBeNull();
  });

  it("returns null when session is missing githubLogin", async () => {
    (getServerSession as any).mockResolvedValue({
      githubId: "12345",
      accessToken: "token-123",
    });

    const result = await getSessionWithToken();

    expect(result).toBeNull();
  });

  it("returns null when session is missing accessToken", async () => {
    (getServerSession as any).mockResolvedValue({
      githubId: "12345",
      githubLogin: "octocat",
    });

    const result = await getSessionWithToken();

    expect(result).toBeNull();
  });

  it("returns null when resolveAppUser returns null", async () => {
    (getServerSession as any).mockResolvedValue({
      githubId: "12345",
      githubLogin: "octocat",
      accessToken: "token-123",
    });
    (resolveAppUser as any).mockResolvedValue(null);

    const result = await getSessionWithToken();

    expect(resolveAppUser).toHaveBeenCalledWith("12345", "octocat");
    expect(result).toBeNull();
  });

  it("returns SessionWithToken with correct shape when all conditions are met", async () => {
    const session = {
      githubId: "12345",
      githubLogin: "octocat",
      accessToken: "token-123",
    };

    (getServerSession as any).mockResolvedValue(session);
    (resolveAppUser as any).mockResolvedValue({ id: "user-1" });

    const result = await getSessionWithToken();

    expect(result).toEqual({
      session,
      accessToken: "token-123",
    });
  });

  it("populates accessToken field from the session", async () => {
    const session = {
      githubId: "67890",
      githubLogin: "hubot",
      accessToken: "gho_abcdef123456",
    };

    (getServerSession as any).mockResolvedValue(session);
    (resolveAppUser as any).mockResolvedValue({ id: "user-2" });

    const result = await getSessionWithToken();

    expect(result?.accessToken).toBe("gho_abcdef123456");
  });
});