vi.mock("@/lib/weekly-webhook-stats", () => ({
  getWeeklyWebhookStats: vi.fn().mockResolvedValue({ commits: 0, prs: 0 }),
}));
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  from: vi.fn(),
  send: vi.fn(),
  batch: vi.fn(),
}));
vi.mock("@/lib/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.user }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/safe-webhook-fetch", () => ({ safeWebhookFetch: mocks.send }));
vi.mock("@/lib/cron-batch", () => ({ claimCronBatch: mocks.batch }));
import { GET, POST } from "@/app/api/notifications/weekly/route";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/notifications/weekly", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "dummy-cron");
  mocks.session.mockResolvedValue({ githubId: "101", githubLogin: "alice" });
  mocks.user.mockResolvedValue({ id: "u1" });
});
afterEach(() => vi.unstubAllEnvs());
it("denies anonymous bulk delivery before reading recipients", async () => {
  expect(
    (await GET(new NextRequest("http://localhost/api/notifications/weekly")))
      .status
  ).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
  expect(mocks.batch).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("denies anonymous manual delivery", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request({}))).status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("prevents one user from delivering another user's webhook", async () => {
  expect((await POST(request({ userId: "u2" }))).status).toBe(403);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("manual delivery reads only the authenticated owner and redacts destinations", async () => {
  const owner = {
    id: "u1",
    github_login: "alice",
    webhook_url: "https://example.com/private-hook",
  };
  const eq = vi.fn();
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq,
    single: vi.fn().mockResolvedValue({ data: owner, error: null }),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
  };
  eq.mockReturnValue(chain);
  mocks.from.mockImplementation((table: string) =>
    table === "goals"
      ? {
          select: () => ({
            eq: () => ({ eq: async () => ({ data: [], error: null }) }),
          }),
        }
      : chain
  );
  mocks.send.mockResolvedValue(new Response(null, { status: 204 }));
  const response = await POST(request({ userId: "u1" }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(eq).toHaveBeenCalledWith("id", "u1");
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(body)).not.toContain("private-hook");
  expect(body.results[0].userId).toBe("u1");
});

it.each([null, [], "invalid"])(
  "rejects malformed manual delivery body %j before sending",
  async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  }
);
