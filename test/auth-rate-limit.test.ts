/**
 * Tests for the authentication rate limiter (issue #1303).
 *
 * DevTrack uses GitHub OAuth exclusively — there is no password, email, or
 * OTP authentication.  The rate limiter therefore protects the endpoints that
 * can be flooded to exhaust GitHub's token-exchange quota or to probe for
 * valid OAuth codes:
 *
 *   POST /api/auth/signin/*      — OAuth initiation
 *   GET  /api/auth/callback/*    — OAuth code exchange
 *   GET  /api/auth/link-github/* — Secondary account link flow
 *
 * The module under test is src/lib/auth-rate-limit.ts, which wraps the shared
 * createMemoryFixedWindowRateLimiter factory with an auth-specific namespace
 * and a 15-minute / 5-request policy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAuthRateLimit,
  isAuthSensitivePath,
  AUTH_LIMIT,
  AUTH_WINDOW_MS,
  AUTH_SENSITIVE_PREFIXES,
} from "../src/lib/auth-rate-limit";

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Returns a fresh module instance with a clean in-memory store.
 * vi.resetModules() re-evaluates the module, which re-creates the Map inside
 * createMemoryFixedWindowRateLimiter, giving each test group a clean slate.
 */
async function freshLimiter() {
  vi.resetModules();
  return import("../src/lib/auth-rate-limit");
}

// ─── isAuthSensitivePath ─────────────────────────────────────────────────────

describe("isAuthSensitivePath", () => {
  it("returns true for /api/auth/signin/github", () => {
    expect(isAuthSensitivePath("/api/auth/signin/github")).toBe(true);
  });

  it("returns true for /api/auth/signin and sub-paths", () => {
    expect(isAuthSensitivePath("/api/auth/signin")).toBe(true);
    expect(isAuthSensitivePath("/api/auth/signin/email")).toBe(true);
  });

  it("returns true for /api/auth/callback/github", () => {
    expect(isAuthSensitivePath("/api/auth/callback/github")).toBe(true);
  });

  it("returns true for /api/auth/link-github and sub-paths", () => {
    expect(isAuthSensitivePath("/api/auth/link-github")).toBe(true);
    expect(isAuthSensitivePath("/api/auth/link-github/callback")).toBe(true);
  });

  it("returns false for /api/auth/session (called on every page render)", () => {
    expect(isAuthSensitivePath("/api/auth/session")).toBe(false);
  });

  it("returns false for /api/auth/csrf (CSRF token fetch)", () => {
    expect(isAuthSensitivePath("/api/auth/csrf")).toBe(false);
  });

  it("returns false for /api/auth/signout", () => {
    expect(isAuthSensitivePath("/api/auth/signout")).toBe(false);
  });

  it("returns false for unrelated API paths", () => {
    expect(isAuthSensitivePath("/api/metrics/streak")).toBe(false);
    expect(isAuthSensitivePath("/api/goals")).toBe(false);
    expect(isAuthSensitivePath("/dashboard")).toBe(false);
  });

  it("is consistent with AUTH_SENSITIVE_PREFIXES", () => {
    for (const prefix of AUTH_SENSITIVE_PREFIXES) {
      expect(isAuthSensitivePath(prefix)).toBe(true);
      expect(isAuthSensitivePath(`${prefix}/sub`)).toBe(true);
    }
  });
});

// ─── checkAuthRateLimit — basic behaviour ────────────────────────────────────

describe("checkAuthRateLimit — basic behaviour", () => {
  it("allows the first request and returns correct remaining count", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const result = check("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AUTH_LIMIT - 1);
  });

  it("decrements remaining on each successive request", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "10.0.0.1";
    for (let i = 0; i < AUTH_LIMIT - 1; i++) {
      const r = check(ip);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(AUTH_LIMIT - 1 - i);
    }
  });

  it("allows exactly AUTH_LIMIT requests then blocks the next one", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "10.0.0.2";
    for (let i = 0; i < AUTH_LIMIT; i++) {
      expect(check(ip).allowed).toBe(true);
    }
    const blocked = check(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("returns a future reset timestamp when blocked", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "10.0.0.3";
    for (let i = 0; i < AUTH_LIMIT; i++) check(ip);
    const result = check(ip);
    expect(result.allowed).toBe(false);
    expect(result.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("continues blocking on all subsequent requests once the limit is hit", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "10.0.0.4";
    for (let i = 0; i < AUTH_LIMIT; i++) check(ip);
    expect(check(ip).allowed).toBe(false);
    expect(check(ip).allowed).toBe(false);
    expect(check(ip).allowed).toBe(false);
  });
});

// ─── window expiry ───────────────────────────────────────────────────────────

describe("checkAuthRateLimit — window expiry", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("resets the counter after AUTH_WINDOW_MS elapses", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "20.0.0.1";

    for (let i = 0; i < AUTH_LIMIT; i++) check(ip);
    expect(check(ip).allowed).toBe(false);

    vi.advanceTimersByTime(AUTH_WINDOW_MS + 1);

    const result = check(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AUTH_LIMIT - 1);
  });

  it("does not reset before the window has fully elapsed", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "20.0.0.2";

    for (let i = 0; i < AUTH_LIMIT; i++) check(ip);

    vi.advanceTimersByTime(AUTH_WINDOW_MS / 2);

    expect(check(ip).allowed).toBe(false);
  });
});

// ─── IP isolation ────────────────────────────────────────────────────────────

describe("checkAuthRateLimit — IP isolation", () => {
  it("counts are tracked independently per IP address", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ipA = "30.0.0.1";
    const ipB = "30.0.0.2";

    for (let i = 0; i < AUTH_LIMIT; i++) check(ipA);
    expect(check(ipA).allowed).toBe(false);

    const result = check(ipB);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AUTH_LIMIT - 1);
  });

  it("blocking one IP does not affect another IP", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const blocked = "40.0.0.1";
    const clean = "40.0.0.2";

    for (let i = 0; i < AUTH_LIMIT + 5; i++) check(blocked);
    expect(check(blocked).allowed).toBe(false);
    expect(check(clean).allowed).toBe(true);
  });
});

// ─── custom limit override ───────────────────────────────────────────────────

describe("checkAuthRateLimit — custom limit override (dev / test mode)", () => {
  it("respects a larger limit (simulates dev / test relaxation)", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "50.0.0.1";
    const devLimit = 1000;

    for (let i = 0; i < devLimit; i++) {
      expect(check(ip, devLimit).allowed).toBe(true);
    }
    expect(check(ip, devLimit).allowed).toBe(false);
  });

  it("enforces a limit of 1 — blocks after a single request", async () => {
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "50.0.0.2";
    expect(check(ip, 1).allowed).toBe(true);
    expect(check(ip, 1).allowed).toBe(false);
  });
});

// ─── reset timestamp ─────────────────────────────────────────────────────────

describe("checkAuthRateLimit — reset timestamp", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("reset points to the end of the current 15-minute fixed window", async () => {
    vi.setSystemTime(new Date(0));
    const { checkAuthRateLimit: check } = await freshLimiter();
    const result = check("60.0.0.1");
    expect(result.reset).toBe(AUTH_WINDOW_MS / 1000);
  });

  it("all requests within the same window share the same reset epoch", async () => {
    vi.setSystemTime(new Date(0));
    const { checkAuthRateLimit: check } = await freshLimiter();
    const ip = "60.0.0.2";

    const r1 = check(ip);
    vi.advanceTimersByTime(30_000);
    const r2 = check(ip);

    expect(r1.reset).toBe(r2.reset);
  });
});
