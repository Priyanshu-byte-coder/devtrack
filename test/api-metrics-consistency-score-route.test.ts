import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/metrics/consistency-score/route";
import { getServerSession } from "@/lib/server-session";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  getAccountToken: vi.fn(),
  getAllAccounts: vi.fn(),
  collectAuthorCommits: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: mocks.resolveAppUser,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

vi.mock("@/lib/github-accounts", () => ({
  getAccountToken: mocks.getAccountToken,
  getAllAccounts: mocks.getAllAccounts,
}));

vi.mock("@/lib/github-search", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/github-search")>();
  return {
    ...actual,
    collectAuthorCommits: mocks.collectAuthorCommits,
  };
});

vi.mock("@/lib/metrics-cache", () => ({
  METRICS_CACHE_TTL_SECONDS: { streak: 120 },
  isMetricsCacheBypassed: vi.fn(() => false),
  metricsCacheKey: vi.fn(() => "test-cache-key"),
  withMetricsCache: vi.fn(
    async (_options: unknown, callback: () => Promise<unknown>) => callback()
  ),
}));

let sessionCount = 0;

function request(url = "http://localhost/api/metrics/consistency-score") {
  return new NextRequest(url);
}

describe("GET /api/metrics/consistency-score", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    sessionCount++;
    vi.mocked(getServerSession).mockResolvedValue({
      accessToken: "test-token",
      githubLogin: "test-user",
      githubId: `github-${sessionCount}`,
    } as never);

    mocks.resolveAppUser.mockResolvedValue({ id: `user-${sessionCount}` });

    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { timezone: "UTC" },
            error: null,
          }),
        }),
      }),
    });

    mocks.collectAuthorCommits.mockResolvedValue({
      items: [
        {
          commit: {
            author: { date: "2026-11-20T10:00:00.000Z" },
          },
        },
        {
          commit: {
            author: { date: "2026-11-21T10:00:00.000Z" },
          },
        },
      ],
    });

    mocks.getAccountToken.mockResolvedValue("account-token");
    mocks.getAllAccounts.mockResolvedValue([]);
  });

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.collectAuthorCommits).not.toHaveBeenCalled();
  });

  it("returns 404 when the Supabase account lookup fails", async () => {
    mocks.supabaseFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { timezone: "UTC" },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Database unavailable" },
              }),
            }),
          }),
        }),
      });

    const res = await GET(
      request("http://localhost/api/metrics/consistency-score?accountId=other-account")
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Account not found" });
  });

  it("returns 429 when GitHub rate limiting is encountered", async () => {
    mocks.collectAuthorCommits.mockResolvedValue({
      items: [],
      retryAfter: 60,
    });

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("GITHUB_RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns the consistency score with the expected response shape", async () => {
    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        grade: expect.stringMatching(/^[SABCD]$/),
        weeklyConsistency: expect.any(Number),
        monthlyTrend: expect.any(Array),
        longestGap: expect.any(Number),
        avgDailyCommits: expect.any(Number),
        streakQuality: expect.any(Number),
        improvementTip: expect.any(String),
      })
    );
  });
});

