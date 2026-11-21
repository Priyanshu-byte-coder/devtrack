import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  clearLeaderboardCache: vi.fn(),
  invalidatePublicProfile: vi.fn(),
}));
vi.mock("@/lib/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.user }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: mocks.from },
}));
vi.mock("@/lib/leaderboard", () => ({
  clearLeaderboardCache: mocks.clearLeaderboardCache,
}));
vi.mock("@/lib/public-profile-tags", () => ({
  invalidatePublicProfile: mocks.invalidatePublicProfile,
}));
import { DELETE } from "@/app/api/user/data-export/route";
const request = (body: unknown = { confirmText: "DELETE" }) =>
  new NextRequest("http://localhost/api/user/data-export", {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: {
      cookie:
        "next-auth.session-token.0=part0; next-auth.session-token.1=part1; __Secure-next-auth.session-token.0=secure; unrelated=retain",
    },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ githubId: "101", githubLogin: "renamed" });
  mocks.user.mockResolvedValue({ id: "u1" });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.clearLeaderboardCache.mockResolvedValue(undefined);
  mocks.from.mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
});
it("denies anonymous deletion before writing", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await DELETE(request())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
});
it.each([null, [], {}, { confirmText: "delete" }])(
  "requires explicit confirmation for %j",
  async (body) => {
    expect((await DELETE(request(body))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  }
);
it("uses one identity-checked transaction and expires every session chunk", async () => {
  const response = await DELETE(request());
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("delete_app_user", {
    p_user_id: "u1",
    p_github_id: "101",
  });
  for (const name of [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token.0",
    "next-auth.session-token.1",
    "__Secure-next-auth.session-token.0",
  ]) {
    const cookie = response.cookies.get(name);
    expect(cookie?.value).toBe("");
    expect(
      cookie?.expires instanceof Date
        ? cookie.expires.getTime()
        : cookie?.expires
    ).toBe(0);
    expect(cookie?.httpOnly).toBe(true);
  }
  expect(response.cookies.get("unrelated")).toBeUndefined();
});
it("reports database failure without reporting success or signing out", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { message: "failed transaction" },
  });
  const response = await DELETE(request());
  expect(response.status).toBe(503);
  expect((await response.json()).success).toBeUndefined();
  expect(response.cookies.getAll()).toHaveLength(0);
  expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  expect(mocks.invalidatePublicProfile).not.toHaveBeenCalled();
});
it("reports a stale user instead of successful deletion", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect((await DELETE(request())).status).toBe(404);
  expect(mocks.clearLeaderboardCache).not.toHaveBeenCalled();
  expect(mocks.invalidatePublicProfile).not.toHaveBeenCalled();
});
it("drops the deleted account from the cached leaderboard and public profile", async () => {
  expect((await DELETE(request())).status).toBe(200);
  expect(mocks.clearLeaderboardCache).toHaveBeenCalledOnce();
  expect(mocks.invalidatePublicProfile).toHaveBeenCalledExactlyOnceWith(
    "renamed"
  );
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.clearLeaderboardCache.mock.invocationCallOrder[0]
  );
});
it("still reports the deletion when cache eviction fails", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.clearLeaderboardCache.mockRejectedValueOnce(
    new Error("Redis unavailable")
  );
  mocks.invalidatePublicProfile.mockImplementationOnce(() => {
    throw new Error("outside a request scope");
  });
  const response = await DELETE(request());
  expect(response.status).toBe(200);
  expect((await response.json()).success).toBe(true);
  expect(response.cookies.get("next-auth.session-token")?.value).toBe("");
  expect(consoleError).toHaveBeenCalledTimes(2);
  consoleError.mockRestore();
});
