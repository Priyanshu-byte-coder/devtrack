import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/wrapped/route";
import { GitHubRateLimitError } from "@/lib/github-rate-limit";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  githubRequest: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/github-request", () => ({
  githubRequest: mocks.githubRequest,
}));

vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: vi.fn(() => false),
  metricsCacheKey: vi.fn(() => "test-wrapped-cache-key"),
  withMetricsCache: vi.fn(
    async <T>(_options: unknown, loader: () => Promise<T>): Promise<T> =>
      loader()
  ),
}));

function createRequest(path = "/api/wrapped?year=2024") {
  return new NextRequest(`https://devtrack.live${path}`);
}

function githubResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const summaryResponse = {
  data: {
    user: {
      contributionsCollection: {
        totalCommitContributions: 2,
        contributionCalendar: {
          weeks: [
            {
              contributionDays: [
                { date: "2024-01-01", contributionCount: 2 },
              ],
            },
          ],
        },
        commitContributionsByRepository: [
          {
            contributions: { totalCount: 2 },
            repository: {
              nameWithOwner: "alice/demo",
              isPrivate: false,
              languages: {
                edges: [
                  { size: 100, node: { name: "TypeScript" } },
                ],
              },
            },
          },
        ],
      },
    },
    merged: { issueCount: 1 },
  },
};

describe("/api/wrapped route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-12345",
      githubLogin: "alice",
      accessToken: "gho_mock_token",
    });

    mocks.githubRequest.mockImplementation(async (url: string) => {
      if (url.includes("/graphql")) {
        return githubResponse(summaryResponse);
      }

      return githubResponse({ total_count: 0, items: [] });
    });
  });

  it("returns 401 when there is no authenticated session", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.githubRequest).not.toHaveBeenCalled();
  });

  it("returns 502 when the GitHub GraphQL request fails", async () => {
    mocks.githubRequest.mockRejectedValue(
      new Error("GitHub API temporarily unavailable")
    );

    const response = await GET(createRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "GitHub API error",
    });
  });

  it("returns 429 when GitHub rate limiting is encountered", async () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 45;

    const rateLimitError = new GitHubRateLimitError(
      {
        code: "GITHUB_RATE_LIMITED",
        message: "GitHub API rate limit reached. Please try again later.",
        resetAt: new Date(resetEpoch * 1000).toISOString(),
        resetAtEpoch: resetEpoch,
      },
      45
    );

    mocks.githubRequest.mockRejectedValue(rateLimitError);

    const response = await GET(createRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");

    expect(await response.json()).toMatchObject({
      error: "GITHUB_RATE_LIMITED",
      rateLimit: {
        resetAtEpoch: resetEpoch,
      },
    });
  });

  it("returns wrapped statistics with the expected response shape", async () => {
    const response = await GET(createRequest());

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toMatchObject({
      year: 2024,
      username: "alice",
      totalCommits: 2,
      activeDays: 1,
      prsMerged: 1,
      mostContributedRepo: {
        name: "alice/demo",
        commits: 2,
      },
      topLanguages: [
        {
          name: "TypeScript",
          bytes: 100,
          percentage: 100,
        },
      ],
      partial: false,
    });

    expect(body).toHaveProperty("longestStreak");
    expect(body).toHaveProperty("mostProductiveMonth");
    expect(body).toHaveProperty("peakCodingHour");
    expect(body).toHaveProperty("personality");
    expect(body).toHaveProperty("generatedAt");
    expect(mocks.githubRequest).toHaveBeenCalledTimes(2);
  });
});
