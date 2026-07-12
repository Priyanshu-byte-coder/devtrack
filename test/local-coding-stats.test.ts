import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/local-coding/stats/route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  order: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: mocks.resolveAppUser,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}));

function createRequest(days = 30) {
  return new NextRequest(`http://localhost/api/local-coding/stats?days=${days}`);
}

describe("Local Coding Stats GET API Endpoint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerSession.mockResolvedValue({
      githubId: "12345",
      githubLogin: "test-user",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });

    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ gte: mocks.gte });
    mocks.gte.mockReturnValue({ order: mocks.order });
    mocks.order.mockResolvedValue({ data: [], error: null });
  });

  it("returns empty stats when the query succeeds with no sessions", async () => {
    const res = await GET(createRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      dailyData: [],
      totals: {
        totalSeconds: 0,
        totalDays: 0,
        avgSecondsPerDay: 0,
      },
      hasData: false,
    });
  });

  it("returns 500 when Supabase fails instead of hiding the error as empty stats", async () => {
    const dbError = { message: "relation local_coding_sessions does not exist" };
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.order.mockResolvedValue({ data: null, error: dbError });

    const res = await GET(createRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch local coding stats" });
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to fetch local coding stats:", dbError);
  });
});
