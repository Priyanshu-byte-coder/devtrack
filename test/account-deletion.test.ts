import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.user }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: mocks.from },
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
  mocks.from.mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
});
it("denies anonymous deletion before writing", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await DELETE(request())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
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
});
it("reports a stale user instead of successful deletion", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect((await DELETE(request())).status).toBe(404);
});
