import { describe, it, expect, afterEach } from "vitest";
import { createMemoryFixedWindowRateLimiter, getClientIp } from "./rate-limit";

describe("getClientIp", () => {
  it("prefers cf-connecting-ip as first priority", () => {
    const req = {
      headers: new Headers({ "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "1.1.1.1" }),
    };
    expect(getClientIp(req as any)).toBe("203.0.113.1");
  });

  it("prefers cf-connecting-ip over x-real-ip and x-forwarded-for", () => {
    const req = {
      ip: undefined,
      headers: new Headers({
        "cf-connecting-ip": "203.0.113.2",
        "x-real-ip": "203.0.113.3",
        "x-forwarded-for": "203.0.113.4",
      }),
    };
    expect(getClientIp(req as any)).toBe("203.0.113.2");
  });

  it("falls back to x-real-ip and then first x-forwarded-for hop", () => {
    const req = {
      ip: undefined,
      headers: new Headers({
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
        "x-real-ip": "203.0.113.5",
      }),
    };
    expect(getClientIp(req as any)).toBe("203.0.113.5");

    const req2 = {
      ip: undefined,
      headers: new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }),
    };
    expect(getClientIp(req2 as any)).toBe("1.1.1.1");
  });
});

describe("createMemoryFixedWindowRateLimiter", () => {
  it("evicts expired entries during prune", () => {
    const limiter = createMemoryFixedWindowRateLimiter({
      windowMs: 1000,
      pruneIntervalMs: 0,
      maxEntries: 100,
    });

    limiter.check("k1", 5, 0);
    expect(limiter._unsafeBuckets.has("k1")).toBe(true);

    limiter.check("k2", 5, 2000);
    expect(limiter._unsafeBuckets.has("k1")).toBe(false);
  });

  it("caps bucket growth with maxEntries", () => {
    const limiter = createMemoryFixedWindowRateLimiter({
      windowMs: 60_000,
      pruneIntervalMs: 0,
      maxEntries: 2,
    });

    limiter.check("a", 1, 0);
    limiter.check("b", 1, 0);
    limiter.check("c", 1, 0);

    expect(limiter._unsafeBuckets.size).toBeLessThanOrEqual(2);
  });
});

describe("getClientIp — trusted proxy behaviour", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("trusts x-real-ip when TRUSTED_PROXY=vercel", () => {
    process.env.TRUSTED_PROXY = "vercel";
    const req = {
      headers: new Headers({ "x-real-ip": "1.2.3.4", "cf-connecting-ip": "9.9.9.9" }),
    };
    expect(getClientIp(req as any)).toBe("1.2.3.4");
  });

  it("trusts cf-connecting-ip when TRUSTED_PROXY=cloudflare", () => {
    process.env.TRUSTED_PROXY = "cloudflare";
    const req = {
      headers: new Headers({ "cf-connecting-ip": "5.6.7.8", "x-real-ip": "9.9.9.9" }),
    };
    expect(getClientIp(req as any)).toBe("5.6.7.8");
  });

  it("returns unknown and ignores all headers when TRUSTED_PROXY=none", () => {
    process.env.TRUSTED_PROXY = "none";
    process.env.VERCEL = undefined;
    const req = {
      headers: new Headers({
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "cf-connecting-ip": "3.3.3.3",
      }),
    };
    // Spoofed headers must be ignored entirely
    expect(getClientIp(req as any)).toBe("unknown");
  });

  it("auto-detects Vercel when VERCEL=1 and no TRUSTED_PROXY set", () => {
    delete process.env.TRUSTED_PROXY;
    process.env.VERCEL = "1";
    const req = {
      headers: new Headers({ "x-real-ip": "7.7.7.7" }),
    };
    expect(getClientIp(req as any)).toBe("7.7.7.7");
  });
});