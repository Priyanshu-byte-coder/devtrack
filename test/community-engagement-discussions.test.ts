import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/metrics/devtrack-badges/route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: vi.fn(() => true),
  metricsCacheKey: vi.fn(
    (userId: string, endpoint: string, params: Record<string, string>) =>
      `metrics:${userId}:${endpoint}:${JSON.stringify(params)}`
  ),
  withMetricsCache: vi.fn(async (_config: unknown, callback: () => unknown) =>
    callback()
  ),
  METRICS_CACHE_TTL_SECONDS: {
    contributions: 3600,
  },
}));

const originalFetch = global.fetch;

function searchResponse(total_count: number) {
  return {
    ok: true,
    json: async () => ({ total_count }),
  };
}

function graphqlDiscussions(
  discussionsStarted: number,
  discussionComments: number
) {
  return {
    ok: true,
    json: async () => ({
      data: {
        viewer: {
          contributionsCollection: {
            totalDiscussionContributions: discussionsStarted,
            totalDiscussionCommentContributions: discussionComments,
          },
        },
      },
    }),
  };
}

describe("Community engagement score (devtrack-badges)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        accessToken: "test-token",
        githubLogin: "test-user",
        githubId: "user-123",
      }
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 401 when unauthenticated", async () => {
    (getServerSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );
    const res = await GET(
      new NextRequest("http://localhost/api/metrics/devtrack-badges")
    );
    expect(res.status).toBe(401);
  });

  it("includes GraphQL discussion activity in the breakdown", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.github.com/graphql")) {
        return graphqlDiscussions(3, 5) as Response;
      }
      return searchResponse(0) as Response;
    }) as typeof fetch;

    const res = await GET(
      new NextRequest("http://localhost/api/metrics/devtrack-badges")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.breakdown.discussions).toEqual({ count: 8, points: 15 });
    expect(data.total).toBe(15);
    expect(data.label).toBe("Newcomer");
  });

  it("reports zero discussions when the user has no recent activity", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.github.com/graphql")) {
        return graphqlDiscussions(0, 0) as Response;
      }
      return searchResponse(2) as Response;
    }) as typeof fetch;

    const res = await GET(
      new NextRequest("http://localhost/api/metrics/devtrack-badges")
    );
    const data = await res.json();

    expect(data.breakdown.discussions).toEqual({ count: 0, points: 0 });
    // 5 search endpoints each return count 2:
    // reviews 6, issuesOpened 4, issuesClosed 6, openSource 10, docs 10 = 36
    expect(data.total).toBe(36);
  });

  it("keeps discussions at zero when GraphQL fails", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.github.com/graphql")) {
        return { ok: false, status: 502, json: async () => ({}) } as Response;
      }
      return searchResponse(1) as Response;
    }) as typeof fetch;

    const res = await GET(
      new NextRequest("http://localhost/api/metrics/devtrack-badges")
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.breakdown.discussions).toEqual({ count: 0, points: 0 });
    expect(data.total).toBeGreaterThan(0);
  });
});
