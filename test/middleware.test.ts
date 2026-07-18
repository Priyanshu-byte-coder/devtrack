import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { checkAuthRateLimit, isAuthSensitivePath } from "../src/lib/auth-rate-limit";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

vi.mock("../src/lib/auth-rate-limit", () => ({
  checkAuthRateLimit: vi.fn(),
  isAuthSensitivePath: vi.fn(),
  AUTH_LIMIT: 5,
  AUTH_SENSITIVE_PREFIXES: ["/api/auth/signin"],
}));

describe("Middleware - Auth Rate Limiting Redirection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to /auth/signin?error=RateLimit for text/html requests when auth rate limit is hit", async () => {
    vi.mocked(isAuthSensitivePath).mockReturnValue(true);
    vi.mocked(checkAuthRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      reset: 1234567890,
    });

    const req = new NextRequest("http://localhost/api/auth/signin/github", {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        "x-forwarded-for": "1.2.3.4",
      },
      method: "POST",
    });

    const res = await middleware(req);

    expect(res).toBeDefined();
    // Redirect status code is 307
    expect(res?.status).toBe(307);
    // Redirect location points to the signin page with error=RateLimit
    expect(res?.headers.get("Location")).toContain("/auth/signin?error=RateLimit");
    // Rate limit headers are present
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res?.headers.get("X-RateLimit-Reset")).toBe("1234567890");
  });

  it("should return JSON error response for non-html requests when auth rate limit is hit", async () => {
    vi.mocked(isAuthSensitivePath).mockReturnValue(true);
    vi.mocked(checkAuthRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      reset: 1234567890,
    });

    const req = new NextRequest("http://localhost/api/auth/signin/github", {
      headers: {
        accept: "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      method: "POST",
    });

    const res = await middleware(req);

    expect(res).toBeDefined();
    // HTTP status code 429 Too Many Requests
    expect(res?.status).toBe(429);
    // Body contains the rate limit error message
    const body = await res?.json();
    expect(body).toEqual({
      error: "Too many authentication attempts. Please try again later.",
    });
    // Rate limit headers are present
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res?.headers.get("X-RateLimit-Reset")).toBe("1234567890");
  });

  it("should allow request to proceed (NextResponse.next) if rate limit is not hit", async () => {
    vi.mocked(isAuthSensitivePath).mockReturnValue(true);
    vi.mocked(checkAuthRateLimit).mockReturnValue({
      allowed: true,
      remaining: 4,
      reset: 1234567890,
    });

    const req = new NextRequest("http://localhost/api/auth/signin/github", {
      headers: {
        accept: "text/html",
        "x-forwarded-for": "1.2.3.4",
      },
      method: "POST",
    });

    const res = await middleware(req);

    expect(res).toBeDefined();
    // Headers or body should indicate it didn't block (status 200 or custom Next.js header/status)
    expect(res?.status).toBe(200);
    expect(res?.headers.get("Location")).toBeNull();
  });
});
