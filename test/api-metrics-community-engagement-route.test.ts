import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/metrics/community-engagement/route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  githubRequest: vi.fn(),
  from: vi.fn(),
  isMetricsCacheBypassed: vi.fn(() => false),
  metricsCacheKey: vi.fn(() => "test-community-engagement"),
  withMetricsCache: vi.fn(
    async <T>(_options: unknown, loader: () => Promise<T>): Promise<T> =>
      loader()
  ),
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

vi.mock("@/lib/github-request", () => ({
  githubRequest: mocks.githubRequest,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}));

vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: mocks.isMetricsCacheBypassed,
  metricsCacheKey: mocks.metricsCacheKey,
  withMetricsCache: mocks.withMetricsCache,
}));

function createRequest() {
  return new NextRequest(
    "https://devtrack.live/api/metrics/community-engagement"
  );
}

function mockSupabase({
  milestones = [],
  freezes = [],
  earned = [],
}: {
  milestones?: Array<{ streak_count: number }>;
  freezes?: Array<{ freeze_date: string }>;
  earned?: Array<{ badge_id: string; earned_at: string }>;
} = {}) {
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(),
      gte: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };

    if (table === "streak_milestones") {
      query.limit.mockResolvedValue({ data: milestones, error: null });
    } else if (table === "streak_freezes") {
      query.gte.mockResolvedValue({ data: freezes, error: null });
    } else if (table === "devtrack_badges") {
      query.eq.mockResolvedValue({ data: earned, error: null });
    }

    return query;
  });
}

function githubResponse(total_count: number) {
  return new Response(JSON.stringify({ total_count }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/metrics/community-engagement route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-123",
      githubLogin: "alice",
      accessToken: "gho_test_token",
    });

    mocks.resolveAppUser.mockResolvedValue({
      id: "user-123",
    });

    mockSupabase();

    mocks.githubRequest.mockResolvedValue(githubResponse(0));
  });

  it("returns 401 when there is no authenticated session", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
    expect(mocks.resolveAppUser).not.toHaveBeenCalled();
  });

  it("returns 404 when the application user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);

    const response = await GET(createRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "User not found",
    });
  });

  it("handles rejected GitHub requests without crashing", async () => {
    mocks.githubRequest.mockRejectedValue(
      new Error("GitHub API network failure")
    );

    const response = await GET(createRequest());

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.badges).toHaveLength(10);
    expect(body.badges.every((badge: { earned: boolean }) => !badge.earned))
      .toBe(true);
  });

  it("returns badges with the expected shape on success", async () => {
    mockSupabase({
      milestones: [{ streak_count: 30 }],
      freezes: Array.from({ length: 7 }, (_, index) => ({
        freeze_date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      })),
      earned: [
        {
          badge_id: "streak-7",
          earned_at: "2026-11-20T10:00:00.000Z",
        },
      ],
    });

    mocks.githubRequest.mockImplementation(async (url: string) => {
      if (url.includes("/search/commits")) {
        return githubResponse(150);
      }
      if (url.includes("type:pr+is:merged")) {
        return githubResponse(12);
      }
      if (url.includes("reviewed-by:")) {
        return githubResponse(55);
      }
      if (url.includes("-user:")) {
        return githubResponse(5);
      }
      if (url.includes("state:closed")) {
        return githubResponse(30);
      }
      return githubResponse(0);
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.badges).toHaveLength(10);
    expect(body.badges[0]).toMatchObject({
      id: "streak-7",
      title: "Week Warrior",
      earned: true,
      earnedAt: "2026-11-20T10:00:00.000Z",
    });

    expect(body.badges[1]).toMatchObject({
      id: "streak-30",
      earned: true,
    });

    expect(body.badges.find(
      (badge: { id: string }) => badge.id === "commits-100"
    )).toMatchObject({
      earned: true,
    });

    expect(mocks.githubRequest).toHaveBeenCalledTimes(5);
  });
});

