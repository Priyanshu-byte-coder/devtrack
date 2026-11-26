import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { githubRequest } from "@/lib/github-request";
import {
  CACHE_REFRESH_SECONDS,
  CACHE_STALE_SECONDS,
  LEADERBOARD_CACHE_KEY,
  LEADERBOARD_BUILD_LOCK_KEY,
  type LeaderboardMetric,
  type LeaderboardPeriod,
  buildLeaderboard,
} from "@/lib/leaderboard";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "user_tokens") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "test-user-1",
                      github_login: "testuser",
                      is_sponsor: false,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      };
    }),
  },
}));

vi.mock("@/lib/github-app", () => ({
  resolveServerGitHubToken: vi.fn().mockResolvedValue("test-shared-token"),
}));

vi.mock("@/lib/metrics-cache", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheGetMany: vi.fn().mockResolvedValue([null]),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDelete: vi.fn().mockResolvedValue(undefined),
  invalidateLeaderboardCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/github-request", () => ({
  githubRequest: vi.fn(),
}));

const originalEnv = process.env.LEADERBOARD_USER_CONCURRENCY;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));

  const contributionDays = Array.from({ length: 31 }, (_, i) => {
    const date = new Date("2026-09-30T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + i);

    return {
      date: date.toISOString().slice(0, 10),
      contributionCount: 1,
    };
  });

  vi.mocked(githubRequest).mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          user: {
            year: {
              contributionYears: [],
              contributionCalendar: {
                weeks: [{ contributionDays }],
              },
            },
            period: {
              totalCommitContributions: 10,
              totalPullRequestContributions: 5,
              totalPullRequestReviewContributions: 2,
              totalRepositoriesWithContributedCommits: 3,
            },
          },
        },
      }),
      { status: 200 }
    )
  );
});

afterEach(() => {
  process.env.LEADERBOARD_USER_CONCURRENCY = originalEnv;
  vi.useRealTimers();
});

describe("exported constants", () => {
  it("CACHE_REFRESH_SECONDS equals 3 hours", () => {
    expect(CACHE_REFRESH_SECONDS).toBe(3 * 3600);
  });

  it("CACHE_STALE_SECONDS equals 21600 (6 hours)", () => {
    expect(CACHE_STALE_SECONDS).toBe(21600);
  });

  it("LEADERBOARD_CACHE_KEY is non-empty string", () => {
    expect(typeof LEADERBOARD_CACHE_KEY).toBe("string");
    expect(LEADERBOARD_CACHE_KEY.length).toBeGreaterThan(0);
  });

  it("LEADERBOARD_BUILD_LOCK_KEY is non-empty string", () => {
    expect(typeof LEADERBOARD_BUILD_LOCK_KEY).toBe("string");
    expect(LEADERBOARD_BUILD_LOCK_KEY.length).toBeGreaterThan(0);
  });

  it("LEADERBOARD_CACHE_KEY differs from BUILD_LOCK_KEY", () => {
    expect(LEADERBOARD_CACHE_KEY).not.toBe(LEADERBOARD_BUILD_LOCK_KEY);
  });
});

describe("exported types", () => {
  it("LeaderboardMetric includes streak, commits, prs", () => {
    const metrics: LeaderboardMetric[] = ["streak", "commits", "prs"];
    expect(metrics).toContain("streak");
    expect(metrics).toContain("commits");
    expect(metrics).toContain("prs");
  });

  it("LeaderboardPeriod includes week, month, all", () => {
    const periods: LeaderboardPeriod[] = ["week", "month", "all"];
    expect(periods).toContain("week");
    expect(periods).toContain("month");
    expect(periods).toContain("all");
  });
});

describe("leaderboard period boundaries", () => {
  it("uses exactly 7 calendar dates for the weekly leaderboard", async () => {
    vi.mocked(githubRequest).mockClear();

    const result = await buildLeaderboard({ period: "week" });

    expect(result.leaders.streak[0]?.activeDays).toBe(7);

    const requestOptions = vi.mocked(githubRequest).mock.calls[0]?.[1];
    const body = JSON.parse(String(requestOptions?.body));

    expect(body.variables.from).toBe("2026-10-24T00:00:00Z");
    expect(result.leaders.commits[0]?.commits).toBe(10);
    expect(result.leaders.prs[0]?.prs).toBe(5);
  });

  it("uses exactly 30 calendar dates for the monthly leaderboard", async () => {
    vi.mocked(githubRequest).mockClear();

    const result = await buildLeaderboard({ period: "month" });

    expect(result.leaders.streak[0]?.activeDays).toBe(30);

    const requestOptions = vi.mocked(githubRequest).mock.calls[0]?.[1];
    const body = JSON.parse(String(requestOptions?.body));

    expect(body.variables.from).toBe("2026-10-01T00:00:00Z");
    expect(result.leaders.commits[0]?.commits).toBe(10);
    expect(result.leaders.prs[0]?.prs).toBe(5);
  });
});
