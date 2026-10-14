// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  token: vi.fn(),
  cookies: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("next-auth/jwt", () => ({ getToken: mocks.token }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth", () => ({ authOptions: { secret: "secret" } }));
import { getServerSession } from "@/lib/server-session";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ githubId: "101", githubLogin: "alice" });
  mocks.token.mockResolvedValue({
    githubId: "101",
    accessToken: "server-secret",
  });
  mocks.cookies.mockResolvedValue({
    getAll: () => [
      { name: "next-auth.session-token.0", value: "chunk-a" },
      { name: "next-auth.session-token.1", value: "chunk-b" },
    ],
  });
});
describe("server-only session credentials", () => {
  it("reads all cookie chunks and adds credentials only on the server", async () => {
    expect((await getServerSession())?.accessToken).toBe("server-secret");
    expect(mocks.token.mock.calls[0][0].req.cookies).toEqual({
      "next-auth.session-token.0": "chunk-a",
      "next-auth.session-token.1": "chunk-b",
    });
  });
  it("fails closed if JWT identity does not match the public session", async () => {
    mocks.token.mockResolvedValue({ githubId: "202", accessToken: "other" });
    expect(await getServerSession()).toBeNull();
  });
  it("fails closed for either revoked or absent tokens", async () => {
    mocks.token.mockResolvedValue({ githubId: "101", error: "TokenRevoked" });
    expect(await getServerSession()).toBeNull();
    mocks.token.mockResolvedValue(null);
    expect(await getServerSession()).toBeNull();
  });
  it("honors explicit HTTP test cookie configuration", async () => {
    await getServerSession({
      secret: "secret",
      providers: [],
      useSecureCookies: false,
    });
    expect(mocks.token.mock.calls[0][0].secureCookie).toBe(false);
  });
  it("uses secure cookies for HTTPS deployments", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://example.com");
    await getServerSession();
    expect(mocks.token.mock.calls[0][0].secureCookie).toBe(true);
    vi.unstubAllEnvs();
  });
});
