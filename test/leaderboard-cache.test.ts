import { describe, it, expect } from "vitest";
import { pruneExpiredLeaderboardCache, pruneExpiredRateLimits } from "../src/lib/leaderboard-cache";

describe("pruneExpiredRateLimits", () => {
  it("removes only expired IP buckets", () => {
    const buckets = new Map([
      ["expired", { count: 20, resetAt: 1_000 }],
      ["active", { count: 2, resetAt: 5_000 }],
    ]);

    pruneExpiredRateLimits(buckets, 2_000);

    expect(buckets.has("expired")).toBe(false);
    expect(buckets.get("active")).toEqual({ count: 2, resetAt: 5_000 });
  });

  it("removes buckets that expire exactly at the boundary", () => {
    const buckets = new Map([
      ["boundary", { count: 1, resetAt: 2_000 }],
      ["future", { count: 1, resetAt: 2_001 }],
    ]);

    pruneExpiredRateLimits(buckets, 2_000);

    expect(buckets.has("boundary")).toBe(false);
    expect(buckets.get("future")).toEqual({ count: 1, resetAt: 2_001 });
  });

  it("handles an empty rate-limit map without mutating it", () => {
    const buckets = new Map<string, { count: number; resetAt: number }>();

    expect(() => pruneExpiredRateLimits(buckets, 2_000)).not.toThrow();
    expect(buckets.size).toBe(0);
  });

  it("drops malformed rate-limit records instead of crashing", () => {
    const buckets = new Map([
      ["valid", { count: 2, resetAt: 5_000 }],
      ["invalid", null as unknown as { count: number; resetAt: number }],
      ["nan", { count: 1, resetAt: Number.NaN }],
    ]);

    expect(() => pruneExpiredRateLimits(buckets, 2_000)).not.toThrow();
    expect(buckets.has("valid")).toBe(true);
    expect(buckets.has("invalid")).toBe(false);
    expect(buckets.has("nan")).toBe(false);
  });
});

describe("pruneExpiredLeaderboardCache", () => {
  it("clears stale leaderboard payloads", () => {
    const cache = {
      expiresAt: 1_000,
      payload: { ok: true },
    };

    expect(pruneExpiredLeaderboardCache(cache, 1_001)).toBe(null);
  });

  it("treats entries expiring exactly now as stale", () => {
    const cache = {
      expiresAt: 1_000,
      payload: { data: "boundary" },
    };

    expect(pruneExpiredLeaderboardCache(cache, 1_000)).toBe(null);
  });

  it("keeps fresh leaderboard payloads", () => {
    const cache = {
      expiresAt: 2_000,
      payload: { ok: true },
    };

    expect(pruneExpiredLeaderboardCache(cache, 1_999)).toBe(cache);
  });

  it("expires entry exactly at boundary timestamp", () => {
    const cache = {
      expiresAt: 1_000,
      payload: { data: "test" },
    };

    expect(pruneExpiredLeaderboardCache(cache, 1_000)).toBe(null);
  });

  it("handles entry expiring 1ms before current", () => {
    const cache = {
      expiresAt: 999,
      payload: { data: "almost-expired" },
    };

    expect(pruneExpiredLeaderboardCache(cache, 1_000)).toBe(null);
  });

  it("handles null and undefined entries", () => {
    expect(pruneExpiredLeaderboardCache(null)).toBe(null);
    expect(pruneExpiredLeaderboardCache(null, 500)).toBe(null);
    expect(pruneExpiredLeaderboardCache(undefined, 500)).toBe(null);
  });

  it("keeps entry with far future expiry", () => {
    const now = Date.now();
    const cache = {
      expiresAt: now + 86400000,
      payload: { data: "future" },
    };

    expect(pruneExpiredLeaderboardCache(cache, now)).toEqual(cache);
  });

  it("drops malformed cache metadata instead of crashing", () => {
    const malformed = {
      expiresAt: Number.NaN,
      payload: { data: "broken" },
    };

    expect(pruneExpiredLeaderboardCache(malformed, 1_000)).toBe(null);
  });

  it("works with different generic types", () => {
    const now = Date.now();
    const stringCache = {
      expiresAt: now + 1000,
      payload: "string data",
    };
    expect(pruneExpiredLeaderboardCache(stringCache, now)).toBe(stringCache);

    const numberCache = {
      expiresAt: now + 1000,
      payload: 42,
    };
    expect(pruneExpiredLeaderboardCache(numberCache, now)).toBe(numberCache);

    const arrayCache = {
      expiresAt: now + 1000,
      payload: [1, 2, 3],
    };
    expect(pruneExpiredLeaderboardCache(arrayCache, now)).toEqual(arrayCache);
  });
});