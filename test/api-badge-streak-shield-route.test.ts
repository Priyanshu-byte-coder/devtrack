import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/badge/streak-shield/route";
import { GitHubRateLimitError } from "@/lib/github-rate-limit";
import type { ActiveDates } from "@/lib/streak-data";

const mocks = vi.hoisted(() => ({
  checkBadgeRateLimit: vi.fn(),
  getBadgeClientIp: vi.fn(),
  isRegisteredDevTrackUser: vi.fn(),
  fetchCommitStreakDates: vi.fn(),
  currentStreakCoverage: vi.fn(),
  calculateStreakFromDates: vi.fn(),
  logError: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/badge-rate-limit", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/badge-rate-limit")>();
  return {
    ...actual,
    checkBadgeRateLimit: mocks.checkBadgeRateLimit,
    getBadgeClientIp: mocks.getBadgeClientIp,
  };
});

vi.mock("@/lib/badge-validation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/badge-validation")>();
  return {
    ...actual,
    isRegisteredDevTrackUser: mocks.isRegisteredDevTrackUser,
  };
});

vi.mock("@/lib/streak-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/streak-data")>();
  return {
    ...actual,
    fetchCommitStreakDates: mocks.fetchCommitStreakDates,
    currentStreakCoverage: mocks.currentStreakCoverage,
  };
});

vi.mock("@/lib/streak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/streak")>();
  return {
    ...actual,
    calculateStreakFromDates: mocks.calculateStreakFromDates,
  };
});

vi.mock("@/lib/error-handler", () => ({
  logError: mocks.logError,
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    from: mocks.supabaseFrom,
  },
}));

function createRequest(
  urlOrPath: string,
  headers: Record<string, string> = {}
): NextRequest {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `https://devtrack.live${urlOrPath}`;
  return new NextRequest(url, { headers });
}

interface SupabaseSetupOptions {
  user?: { id: string; timezone: string | null; github_id: string } | null;
  userError?: { message: string } | null;
  freezes?: { freeze_date: string }[] | null;
  freezesError?: { message: string } | null;
}

function setupSupabase({
  user = { id: "user-uuid-1", timezone: "UTC", github_id: "12345" },
  userError = null,
  freezes = [],
  freezesError = null,
}: SupabaseSetupOptions = {}) {
  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: user,
              error: userError,
            }),
          }),
        }),
      };
    }
    if (table === "streak_freezes") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: freezes,
            error: freezesError,
          }),
        }),
      };
    }
    return {};
  });
}

function createMockActiveDates(
  dates: string[] = ["2026-11-25", "2026-11-26", "2026-11-27"],
  complete = true
): ActiveDates {
  return Object.assign(new Set(dates), {
    complete,
    partialReason: complete ? undefined : "search capped",
  });
}

describe("GET /api/badge/streak-shield route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default rate limit: allowed
    mocks.checkBadgeRateLimit.mockReturnValue({
      allowed: true,
      remaining: 19,
      reset: 1700000060,
    });
    mocks.getBadgeClientIp.mockReturnValue("127.0.0.1");

    // Default registration: registered
    mocks.isRegisteredDevTrackUser.mockResolvedValue(true);

    // Default Supabase: user found, no freezes
    setupSupabase();

    // Default commit streak dates
    mocks.fetchCommitStreakDates.mockResolvedValue(createMockActiveDates());

    // Default streak calculation
    mocks.calculateStreakFromDates.mockReturnValue({
      current: 7,
      longest: 21,
      lastCommitDate: "2026-11-27",
      totalActiveDays: 30,
      freezeDates: [],
    });

    // Default coverage: exact
    mocks.currentStreakCoverage.mockReturnValue("exact");
  });

  describe("Public access", () => {
    it("responds successfully without any auth session or headers", async () => {
      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      const body = await res.text();
      expect(body).toContain("<svg");
      expect(body).toContain("7-day streak");
    });
  });

  describe("Rate limiting", () => {
    it("returns 429 when checkBadgeRateLimit returns allowed: false", async () => {
      mocks.checkBadgeRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        reset: 1700000060,
      });

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeDefined();
      expect(res.headers.get("X-RateLimit-Limit")).toBe("20");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(res.headers.get("X-RateLimit-Reset")).toBe("1700000060");

      const body = await res.text();
      expect(body).toBe("Rate limit exceeded");
    });

    it("extracts client IP using getBadgeClientIp", async () => {
      mocks.getBadgeClientIp.mockImplementation(
        (request: NextRequest) =>
          request.headers.get("x-vercel-forwarded-for") || "unknown"
      );

      const req = createRequest("/api/badge/streak-shield?user=octocat", {
        "x-vercel-forwarded-for": "203.0.113.195",
      });
      await GET(req);

      expect(mocks.getBadgeClientIp).toHaveBeenCalledWith(req);
      expect(mocks.checkBadgeRateLimit).toHaveBeenCalledWith("203.0.113.195");
    });
  });

  describe("Input validation", () => {
    it("returns 400 SVG error when user parameter is missing", async () => {
      const req = createRequest("/api/badge/streak-shield");
      const res = await GET(req);

      expect(res.status).toBe(400);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      const body = await res.text();
      expect(body).toContain("invalid user");
    });

    it("returns 400 SVG error when user parameter is empty", async () => {
      const req = createRequest("/api/badge/streak-shield?user=");
      const res = await GET(req);

      expect(res.status).toBe(400);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      const body = await res.text();
      expect(body).toContain("invalid user");
    });

    it("returns 400 SVG error when user parameter is whitespace only", async () => {
      const req = createRequest("/api/badge/streak-shield?user=%20%20");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("invalid user");
    });

    it("returns 400 SVG error for username starting with a hyphen", async () => {
      const req = createRequest("/api/badge/streak-shield?user=-octocat");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("invalid user");
    });

    it("returns 400 SVG error for username ending with a hyphen", async () => {
      const req = createRequest("/api/badge/streak-shield?user=octocat-");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("invalid user");
    });

    it("returns 400 SVG error for username with special characters or slashes", async () => {
      const req = createRequest("/api/badge/streak-shield?user=octo/cat");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("invalid user");
    });

    it("returns 400 SVG error for username longer than 39 characters", async () => {
      const longUser = "a".repeat(40);
      const req = createRequest(`/api/badge/streak-shield?user=${longUser}`);
      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain("invalid user");
    });

    it("normalizes and accepts valid username with leading or trailing whitespace", async () => {
      const req = createRequest("/api/badge/streak-shield?user=%20octocat%20");
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mocks.isRegisteredDevTrackUser).toHaveBeenCalledWith("octocat");
    });
  });

  describe("DevTrack registration allowlist", () => {
    it("returns 404 SVG error when user is not registered in DevTrack", async () => {
      mocks.isRegisteredDevTrackUser.mockResolvedValue(false);

      const req = createRequest(
        "/api/badge/streak-shield?user=unregistered-user"
      );
      const res = await GET(req);

      expect(res.status).toBe(404);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      const body = await res.text();
      expect(body).toContain("user not found");
      expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    });
  });

  describe("Database errors (Supabase resilience)", () => {
    it("returns 500 SVG error and logs when user query returns an error", async () => {
      setupSupabase({
        user: null,
        userError: { message: "connection timeout" },
      });

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");

      const body = await res.text();
      expect(body).toContain("unavailable");

      expect(mocks.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          endpoint: "/api/badge/streak-shield",
          operation: "generate_badge",
          additionalContext: { username: "octocat" },
        })
      );
    });

    it("returns 500 SVG error and logs when user data is null", async () => {
      setupSupabase({ user: null, userError: null });

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toContain("unavailable");
      expect(mocks.logError).toHaveBeenCalled();
    });

    it("returns 500 SVG error and logs when streak freezes query returns an error", async () => {
      setupSupabase({
        freezes: null,
        freezesError: { message: "streak_freezes table inaccessible" },
      });

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toContain("unavailable");
      expect(mocks.logError).toHaveBeenCalled();
    });
  });

  describe("GitHub commit streak fetch errors", () => {
    it("returns 500 SVG error and logs when fetchCommitStreakDates throws general error", async () => {
      mocks.fetchCommitStreakDates.mockRejectedValue(
        new Error("GitHub API network failure")
      );

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toContain("unavailable");
      expect(mocks.logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "GitHub API network failure" }),
        expect.any(Object)
      );
    });

    it("returns 429 JSON response when fetchCommitStreakDates throws GitHubRateLimitError", async () => {
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

      mocks.fetchCommitStreakDates.mockRejectedValue(rateLimitError);

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("45");

      const body = await res.json();
      expect(body).toMatchObject({
        error: "GITHUB_RATE_LIMITED",
        rateLimit: {
          resetAtEpoch: resetEpoch,
        },
      });
      // logError should NOT be called for clean rate limit handling
      expect(mocks.logError).not.toHaveBeenCalled();
    });
  });

  describe("Streak coverage and badge rendering", () => {
    it("renders exact streak badge with standard cache headers", async () => {
      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
      expect(res.headers.get("Cache-Control")).toBe(
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
      );
      expect(res.headers.get("ETag")).toBeTruthy();
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Content-Security-Policy")).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; sandbox"
      );
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("19");
      expect(res.headers.get("X-RateLimit-Reset")).toBe("1700000060");

      const body = await res.text();
      expect(body).toContain("DevTrack: 7-day streak, best 21 days");
    });

    it("renders lower-bound streak badge when coverage is lower-bound", async () => {
      mocks.currentStreakCoverage.mockReturnValue("lower-bound");
      mocks.calculateStreakFromDates.mockReturnValue({
        current: 1,
        longest: 1,
        lastCommitDate: "2026-11-27",
        totalActiveDays: 1,
        freezeDates: [],
      });

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("1+-day streak, best 1+ day");
    });

    it("renders syncing badge with short cache when coverage is unknown", async () => {
      mocks.currentStreakCoverage.mockReturnValue("unknown");

      const req = createRequest("/api/badge/streak-shield?user=octocat");
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, max-age=300, s-maxage=300"
      );

      const body = await res.text();
      expect(body).toContain("syncing");
    });
  });

  describe("HTTP 304 conditional request handling", () => {
    it("returns 304 Not Modified when If-None-Match matches the computed ETag", async () => {
      // First request to obtain ETag
      const initialReq = createRequest("/api/badge/streak-shield?user=octocat");
      const initialRes = await GET(initialReq);
      const etag = initialRes.headers.get("ETag");
      expect(etag).toBeTruthy();

      // Conditional request
      const conditionalReq = createRequest(
        "/api/badge/streak-shield?user=octocat",
        {
          "if-none-match": etag!,
        }
      );
      const conditionalRes = await GET(conditionalReq);

      expect(conditionalRes.status).toBe(304);
      expect(conditionalRes.headers.get("ETag")).toBe(etag);
      const body = await conditionalRes.text();
      expect(body).toBe("");
    });

    it("returns 200 when If-None-Match does not match", async () => {
      const conditionalReq = createRequest(
        "/api/badge/streak-shield?user=octocat",
        {
          "if-none-match": '"stale-etag-value"',
        }
      );
      const conditionalRes = await GET(conditionalReq);

      expect(conditionalRes.status).toBe(200);
      const body = await conditionalRes.text();
      expect(body).toContain("<svg");
    });
  });
});
