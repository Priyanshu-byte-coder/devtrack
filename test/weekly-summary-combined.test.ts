import "./setup";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { getAllAccounts, getAccountToken } from "@/lib/github-accounts";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: vi.fn().mockReturnValue(false),
  metricsCacheKey: vi.fn().mockImplementation((userId, endpoint, params) => {
    return `metrics:${userId}:${endpoint}:${JSON.stringify(params || {})}`;
  }),
  withMetricsCache: vi.fn().mockImplementation((_opts: unknown, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/resolve-user", () => ({
  resolveAppUser: vi.fn(),
}));

vi.mock("@/lib/github-accounts", () => ({
  getAccountToken: vi.fn(),
  getAllAccounts: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

const mockGetServerSession = vi.mocked(getServerSession);
const mockResolveAppUser = vi.mocked(resolveAppUser);
const mockGetAllAccounts = vi.mocked(getAllAccounts);
const mockGetAccountToken = vi.mocked(getAccountToken);

describe("GET /api/metrics/weekly-summary?accountId=combined", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("successfully fetches and merges weekly summaries across all linked accounts", async () => {
    // 1. Session Setup
    mockGetServerSession.mockResolvedValue({
      accessToken: "primary-token",
      githubLogin: "primary-login",
      githubId: "111",
    } as any);

    // 2. Database User Row Setup
    mockResolveAppUser.mockResolvedValue({ id: "user-row-id" } as any);

    // 3. Accounts List Setup
    mockGetAllAccounts.mockResolvedValue([
      { githubId: "111", githubLogin: "primary-login", token: "primary-token" },
      { githubId: "222", githubLogin: "linked-login", token: "linked-token" },
    ]);

    mockGetAccountToken.mockImplementation(async (userId, accountId) => {
      if (accountId === "222") return "linked-token";
      return null;
    });

    // 4. Mock GitHub API Responses for both accounts
    mockFetch.mockImplementation(async (url: string) => {
      // Commits search for primary-login
      if (url.includes("search/commits") && url.includes("author:primary-login")) {
        if (url.includes("&page=")) {
          // fetchActiveDates (streak) call
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                { commit: { author: { date: "2026-06-14T12:00:00Z" } } }, // Sunday
                { commit: { author: { date: "2026-06-13T12:00:00Z" } } }, // Saturday
              ],
            }),
          } as any;
        }
        // 14-day commits call
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              { commit: { author: { date: "2026-06-15T08:00:00Z" } }, repository: { full_name: "org/repo-a" } }, // Monday (this week)
              { commit: { author: { date: "2026-06-13T12:00:00Z" } }, repository: { full_name: "org/repo-a" } }, // Saturday (last week)
            ],
          }),
        } as any;
      }

      // Commits search for linked-login
      if (url.includes("search/commits") && url.includes("author:linked-login")) {
        if (url.includes("&page=")) {
          // fetchActiveDates (streak) call
          return {
            ok: true,
            status: 200,
            json: async () => ({
              items: [
                { commit: { author: { date: "2026-06-14T12:00:00Z" } } },
                { commit: { author: { date: "2026-06-12T12:00:00Z" } } },
              ],
            }),
          } as any;
        }
        // 14-day commits call
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              { commit: { author: { date: "2026-06-15T09:00:00Z" } }, repository: { full_name: "org/repo-b" } }, // Monday (this week)
              { commit: { author: { date: "2026-06-12T12:00:00Z" } }, repository: { full_name: "org/repo-b" } }, // Friday (last week)
            ],
          }),
        } as any;
      }

      // PRs search for both accounts
      if (url.includes("search/issues") && url.includes("type:pr")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              { created_at: "2026-06-15T10:00:00Z", state: "closed", pull_request: { merged_at: "2026-06-15T11:00:00Z" } },
            ],
          }),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as any;
    });

    const { GET } = await import("@/app/api/metrics/weekly-summary/route");
    const req = new NextRequest("http://localhost/api/metrics/weekly-summary?accountId=combined");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.commits.current).toBe(2);
    expect(data.commits.previous).toBe(2);
    expect(data.commits.delta).toBe(0);
    expect(data.commits.trend).toBe("same");

    expect(data.prs.thisWeek.opened).toBe(2);
    expect(data.prs.thisWeek.merged).toBe(2);

    expect(data.activeDays.thisWeek).toBe(2);
  });
});
