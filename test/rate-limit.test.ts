import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getClientIp,
  createMemoryFixedWindowRateLimiter,
} from "../src/lib/rate-limit";

/**
 * getClientIp only reads forwarding headers when the deployment declares which
 * proxy sits in front of it. Any client can set x-forwarded-for, x-real-ip or
 * cf-connecting-ip on a direct request, so trusting them unconditionally would
 * let an attacker pick their own rate-limit bucket. These tests therefore pin
 * behaviour per TRUSTED_PROXY mode rather than asserting a single header order.
 */
describe("getClientIp", () => {
  const ORIGINAL_TRUSTED_PROXY = process.env.TRUSTED_PROXY;
  const ORIGINAL_VERCEL = process.env.VERCEL;

  afterEach(() => {
    process.env.TRUSTED_PROXY = ORIGINAL_TRUSTED_PROXY;
    process.env.VERCEL = ORIGINAL_VERCEL;
    if (ORIGINAL_TRUSTED_PROXY === undefined) delete process.env.TRUSTED_PROXY;
    if (ORIGINAL_VERCEL === undefined) delete process.env.VERCEL;
  });

  const reqWith = (headers: Record<string, string>) => ({
    headers: new Headers(headers),
  });

  describe("TRUSTED_PROXY=vercel", () => {
    beforeEach(() => {
      process.env.TRUSTED_PROXY = "vercel";
    });

    it("prefers x-real-ip, which Vercel sets at the edge", () => {
      const req = reqWith({
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      });
      expect(getClientIp(req as any)).toBe("2.2.2.2");
    });

    it("falls back to the first hop of x-forwarded-for", () => {
      const req = reqWith({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" });
      expect(getClientIp(req as any)).toBe("3.3.3.3");
    });

    it("ignores cf-connecting-ip, which no Vercel proxy sets", () => {
      const req = reqWith({ "cf-connecting-ip": "1.1.1.1" });
      expect(getClientIp(req as any)).toBe("unknown");
    });

    it("trims whitespace and skips blank header values", () => {
      const req = reqWith({
        "x-real-ip": "   ",
        "x-forwarded-for": "  6.6.6.6  ",
      });
      expect(getClientIp(req as any)).toBe("6.6.6.6");
    });

    it("returns unknown when no forwarding header is present", () => {
      expect(getClientIp(reqWith({ host: "example.com" }) as any)).toBe(
        "unknown"
      );
    });
  });

  describe("TRUSTED_PROXY=cloudflare", () => {
    beforeEach(() => {
      process.env.TRUSTED_PROXY = "cloudflare";
    });

    it("prefers cf-connecting-ip", () => {
      const req = reqWith({
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      });
      expect(getClientIp(req as any)).toBe("1.1.1.1");
    });

    it("falls back to x-real-ip when cf-connecting-ip is blank", () => {
      const req = reqWith({
        "cf-connecting-ip": "   ",
        "x-real-ip": "2.2.2.2",
      });
      expect(getClientIp(req as any)).toBe("2.2.2.2");
    });

    it("ignores x-forwarded-for, which Cloudflare does not vouch for", () => {
      const req = reqWith({ "x-forwarded-for": "3.3.3.3" });
      expect(getClientIp(req as any)).toBe("unknown");
    });
  });

  describe("TRUSTED_PROXY=none", () => {
    beforeEach(() => {
      process.env.TRUSTED_PROXY = "none";
    });

    it("ignores every forwarding header, because a client can forge them all", () => {
      const req = reqWith({
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      });
      expect(getClientIp(req as any)).toBe("unknown");
    });
  });

  describe("auto-detection", () => {
    it("trusts Vercel headers when VERCEL=1 and TRUSTED_PROXY is unset", () => {
      delete process.env.TRUSTED_PROXY;
      process.env.VERCEL = "1";
      expect(getClientIp(reqWith({ "x-real-ip": "2.2.2.2" }) as any)).toBe(
        "2.2.2.2"
      );
    });

    it("trusts nothing when neither TRUSTED_PROXY nor VERCEL is set", () => {
      delete process.env.TRUSTED_PROXY;
      delete process.env.VERCEL;
      expect(getClientIp(reqWith({ "x-real-ip": "2.2.2.2" }) as any)).toBe(
        "unknown"
      );
    });

    it("falls back to no-trust for an unrecognised TRUSTED_PROXY value", () => {
      process.env.TRUSTED_PROXY = "nginx";
      delete process.env.VERCEL;
      expect(getClientIp(reqWith({ "x-real-ip": "2.2.2.2" }) as any)).toBe(
        "unknown"
      );
    });
  });

  it("handles a request whose headers map returns null for everything", () => {
    process.env.TRUSTED_PROXY = "vercel";
    const req = { headers: { get: () => null } };
    expect(getClientIp(req as any)).toBe("unknown");
  });
});

describe("createMemoryFixedWindowRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows the first request for a new key", () => {
    const limiter = createMemoryFixedWindowRateLimiter({ windowMs: 1000 });
    const result = limiter.check("key1", 5);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.reset).toBeGreaterThan(0);
  });

  it("decrements the remaining count correctly", () => {
    const limiter = createMemoryFixedWindowRateLimiter({ windowMs: 1000 });
    limiter.check("key1", 3);
    const result = limiter.check("key1", 3);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks when the limit is exhausted", () => {
    const limiter = createMemoryFixedWindowRateLimiter({ windowMs: 1000 });
    limiter.check("key1", 2);
    limiter.check("key1", 2);
    const result = limiter.check("key1", 2);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets the limit after the window expires", () => {
    const limiter = createMemoryFixedWindowRateLimiter({ windowMs: 1000 });

    // Exhaust the limit
    limiter.check("key1", 1);
    expect(limiter.check("key1", 1).allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(1001);

    // Should be allowed again
    const result = limiter.check("key1", 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("maintains independent counters for different keys", () => {
    const limiter = createMemoryFixedWindowRateLimiter({ windowMs: 1000 });

    limiter.check("userA", 1);
    expect(limiter.check("userA", 1).allowed).toBe(false);

    // userB should still be allowed
    const resultB = limiter.check("userB", 1);
    expect(resultB.allowed).toBe(true);
    expect(resultB.remaining).toBe(0);
  });

  it("respects the configured limit per check", () => {
    const limiter = createMemoryFixedWindowRateLimiter({ windowMs: 1000 });

    // First request with limit 10
    expect(limiter.check("key1", 10).remaining).toBe(9);

    // Second request with limit 5 -> count is now 2, limit is 5, remaining 3
    expect(limiter.check("key1", 5).remaining).toBe(3);
  });

  it("prunes expired buckets", () => {
    const limiter = createMemoryFixedWindowRateLimiter({
      windowMs: 1000,
      pruneIntervalMs: 500,
    });

    limiter.check("key1", 10);
    expect(limiter._unsafeBuckets.has("key1")).toBe(true);

    // Advance time past prune interval but not window
    vi.advanceTimersByTime(600);
    limiter.check("key2", 10); // Trigger prune
    expect(limiter._unsafeBuckets.has("key1")).toBe(true); // Still valid

    // Advance time past window
    vi.advanceTimersByTime(500);
    limiter.check("key3", 10); // Trigger prune again

    // key1 should be removed
    expect(limiter._unsafeBuckets.has("key1")).toBe(false);
    expect(limiter._unsafeBuckets.has("key2")).toBe(true);
    expect(limiter._unsafeBuckets.has("key3")).toBe(true);
  });

  it("ensures bucket map does not grow unbounded", () => {
    const maxEntries = 5;
    const limiter = createMemoryFixedWindowRateLimiter({
      windowMs: 1000,
      pruneIntervalMs: 0, // Force prune check on every call
      maxEntries,
    });

    // Add more entries than maxEntries
    for (let i = 0; i < maxEntries + 3; i++) {
      limiter.check(`key${i}`, 10);
    }

    // The size should be exactly maxEntries + 1 because prune() is called *before* the new entry is added.
    expect(limiter._unsafeBuckets.size).toBe(maxEntries + 1);

    // The most recently added key should be present
    expect(limiter._unsafeBuckets.has(`key${maxEntries + 2}`)).toBe(true);

    // Some older keys should have been evicted (implementation deletes in map iteration order)
    expect(limiter._unsafeBuckets.has("key0")).toBe(false);
    expect(limiter._unsafeBuckets.has("key1")).toBe(false);
    expect(limiter._unsafeBuckets.has("key2")).toBe(true);
  });
});
