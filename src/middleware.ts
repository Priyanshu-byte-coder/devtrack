import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import {
  checkAuthRateLimit,
  isAuthSensitivePath,
  AUTH_LIMIT,
} from "@/lib/auth-rate-limit";
import {
  isStateChangingMethod,
  isCsrfExempt,
  validateCsrf,
} from "@/lib/csrf";

export const runtime = "nodejs";

const isDev = process.env.NODE_ENV === "development";
const memoryBuckets = new Map<string, number[]>();
const WINDOW_SECONDS = 60;

/* ============================================================
   SECURITY NOTICE: DEVELOPMENT MODE RATE-LIMIT SCALING
   These high thresholds are configured STRICTLY for local mock
   testing pipelines to handle high concurrent local dashboard refreshes.
   NOTE: In Next.js, process.env.NODE_ENV is a compile-time constant.
   It is baked into the bundle at build time and cannot change at runtime.
   Therefore, in production builds, isDev is always false and the
   AUTHENTICATED_LIMIT/ANONYMOUS_LIMIT will always be 60/10 respectively.
   In development (next dev), NODE_ENV is "development" so the higher
   limits apply during local testing only.
   ==========================================
   ============================================================ */
const isTest = isDev || process.env.NODE_ENV === "test";
const AUTHENTICATED_LIMIT = isTest ? 5000 : 60;
const ANONYMOUS_LIMIT = isTest ? 1000 : 10;

/**
 * Configuration constants for API rate limits and window sizes.
 * Values are scaled in development mode (scaled auth: 1000, authenticated metrics: 5000, anonymous metrics: 1000)
 * to prevent developer/testing workflow interruptions under rapid mock API loading.
 */
const RATE_LIMIT_CONFIG = {
  /**
   * The sliding rate limit window size in seconds.
   */
  WINDOW_SECONDS: 60,

  /**
   * Maximum allowed API metrics requests for authenticated users in the window.
   */
  AUTHENTICATED_LIMIT: isTest ? 5000 : 60,

  /**
   * Maximum allowed API metrics requests for anonymous users in the window.
   */
  ANONYMOUS_LIMIT: isTest ? 1000 : 10,

  /**
   * Maximum allowed sign-in attempts for authentication routes in the window.
   */
  AUTH_LIMIT: isTest ? 1000 : AUTH_LIMIT,
} as const;

// Warn in production if Upstash Redis is not configured (rates reset on cold starts)
if (process.env.NODE_ENV === "production" && !process.env.UPSTASH_REDIS_REST_URL) {
  console.warn(
    "UPSTASH_REDIS_REST_URL is not set – rate limits will use in-memory storage and reset on cold starts."
  );
}

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

function getIp(req: NextRequest) {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

function buildHeaders(result: RateLimitResult) {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(result.reset));

  if (!result.allowed) {
    headers.set(
      "Retry-After",
      String(Math.max(result.reset - Math.floor(Date.now() / 1000), 1))
    );
  }

  return headers;
}

/**
 * In-memory sliding-window rate-limit store.
 * Each key maps to an array of request timestamps (milliseconds).
 * Entries are pruned once the map exceeds 500 keys.
 */

function pruneMemoryBuckets(now: number) {
  if (memoryBuckets.size < 500) {
    return;
  }

  const cutoff = now - RATE_LIMIT_CONFIG.WINDOW_SECONDS * 1000;
  for (const [key, values] of Array.from(memoryBuckets.entries())) {
    const active = values.filter((timestamp: number) => timestamp > cutoff);
    if (active.length === 0) {
      memoryBuckets.delete(key);
    } else {
      memoryBuckets.set(key, active);
    }
  }
}

function checkMemoryLimit(
  key: string,
  limit: number,
  now: number
): RateLimitResult {
  pruneMemoryBuckets(now);

  const cutoff = now - RATE_LIMIT_CONFIG.WINDOW_SECONDS * 1000;
  const active = (memoryBuckets.get(key) ?? []).filter(
    (timestamp) => timestamp > cutoff
  );
  const reset = Math.ceil(((active[0] ?? now) + RATE_LIMIT_CONFIG.WINDOW_SECONDS * 1000) / 1000);

  if (active.length >= limit) {
    memoryBuckets.set(key, active);
    return { allowed: false, limit, remaining: 0, reset };
  }

  active.push(now);
  memoryBuckets.set(key, active);

  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - active.length, 0),
    reset,
  };
}

/**
 * ATOMIC LUA EVALUATION IN UPSTASH REDIS
 */
async function checkUpstashLimit(
  key: string,
  limit: number,
  now: number
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  const cutoff = now - RATE_LIMIT_CONFIG.WINDOW_SECONDS * 1000;
  const reset = Math.ceil((now + RATE_LIMIT_CONFIG.WINDOW_SECONDS * 1000) / 1000);
  const memberToken = `${now}:${Math.random().toString(36).slice(2)}`;

  const luaScript = `
    local key = KEYS[1]
    local cutoff = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local windowSeconds = tonumber(ARGV[4])
    local member = ARGV[5]
    redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
    local currentCount = redis.call('ZCARD', key)
    if currentCount >= limit then
      return {0, currentCount}
    else
      redis.call('ZADD', key, now, member)
      redis.call('EXPIRE', key, windowSeconds)
      return {1, currentCount + 1}
    end
  `;

  try {
    const response = await fetch(`${url}/eval`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        script: luaScript,
        keys: [key],
        args: [String(cutoff), String(now), String(limit), String(RATE_LIMIT_CONFIG.WINDOW_SECONDS), memberToken],
      }),
      cache: "no-store",
    });

    if (!response.ok) { return null; }

    const data = await response.json();
    const [allowedFlag, currentCount] = data.result as [number, number];
    return {
      allowed: allowedFlag === 1,
      limit,
      remaining: Math.max(limit - currentCount, 0),
      reset,
    };
  } catch (error) {
    console.error("Rate-limiter cloud pipeline failure, falling back to local memory storage:", error);
    return null;
  }
}

async function checkRateLimit(identifier: string, limit: number) {
  const now = Date.now();
  const key = `metrics-rate-limit:${identifier}`;
  return (
    (await checkUpstashLimit(key, limit, now)) ??
    checkMemoryLimit(key, limit, now)
  );
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // In production (HTTPS), NextAuth.js writes the session to the
  // __Secure-next-auth.session-token cookie (Secure flag set).
  // We must try the secure cookie first; the plain cookie is only
  // present in local development (HTTP, no Secure flag).
  const isProduction = process.env.NODE_ENV === "production";

  let token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isProduction,
    cookieName: isProduction
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token",
  });

  if (!token && (!isProduction || process.env.CI === "true")) {
    // Fallback: try the opposite cookie name to handle edge cases such as
    // a dev build or CI environment that somehow received a Secure cookie.
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: !isProduction,
      cookieName: !isProduction
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
    });
  }

  const isApiStateChange =
    pathname.startsWith("/api/") &&
    isStateChangingMethod(req.method) &&
    !isCsrfExempt(pathname);

  if (isApiStateChange) {
    const csrf = validateCsrf(req);
    if (!csrf.valid) {
      return NextResponse.json({ error: csrf.reason }, { status: 403 });
    }
  }

  const protectedRoutes = ["/dashboard", "/settings"];
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const adminRoutes = ["/admin"];
  const isAdminRoute = adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if ((isProtectedRoute || isAdminRoute) && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isProtectedRoute) {
    return NextResponse.next();
  }

  if (isAdminRoute) {
    // Check if token explicitly has the admin role
    if (!token?.role || token.role !== "admin") {
      return new NextResponse("Forbidden: Admin access required", { status: 403 });
    }
    return NextResponse.next();
  }

  if (isAuthSensitivePath(pathname)) {
    const ip = getIp(req);
    const authLimit = RATE_LIMIT_CONFIG.AUTH_LIMIT;
    const authResult = checkAuthRateLimit(ip, authLimit);

    if (!authResult.allowed) {
      console.warn("auth_rate_limit_hit", { ip, path: pathname });
      const headers = buildHeaders({ ...authResult, limit: authLimit });

      const acceptHeader = req.headers.get("accept") ?? "";
      if (acceptHeader.includes("text/html")) {
        const url = req.nextUrl.clone();
        url.pathname = "/auth/signin";
        url.search = "?error=RateLimit";
        return NextResponse.redirect(url, {
          status: 307,
          headers,
        });
      }

      return NextResponse.json(
        { error: "Too many authentication attempts. Please try again later." },
        { status: 429, headers }
      );
    }

    return NextResponse.next();
  }

  const isRateLimitedPath =
    pathname.startsWith("/api/metrics/") || pathname === "/api/contact";

  if (!isRateLimitedPath) {
    return NextResponse.next();
  }

  const githubId = typeof token?.githubId === "string" ? token.githubId : null;
  const identifier = githubId ? `user:${githubId}` : `ip:${getIp(req)}`;
  const limit = githubId ? RATE_LIMIT_CONFIG.AUTHENTICATED_LIMIT : RATE_LIMIT_CONFIG.ANONYMOUS_LIMIT;

  const result = await checkRateLimit(identifier, limit);
  const headers = buildHeaders(result);

  if (!result.allowed) {
    const isContact = req.nextUrl.pathname.startsWith("/api/contact");
    console.warn(isContact ? "contact_rate_limit_hit" : "metrics_rate_limit_hit", {
      identifier, path: req.nextUrl.pathname, limit,
    });
    return NextResponse.json(
      {
        error: isContact
          ? "Too many submissions. Please retry shortly."
          : "Too many metrics requests. Please retry shortly.",
      },
      { status: 429, headers }
    );
  }

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));

  if (req.method === "GET") {
    response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=600");
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/settings",
    "/settings/:path*",
    "/admin",
    "/admin/:path*",
    "/api/:path*",
  ],
};
