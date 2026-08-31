import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  metricsCacheKey,
  isMetricsCacheBypassed,
  cacheDelete,
  cacheGet,
  cacheSet,
  withMetricsCache,
} from "../src/lib/metrics-cache";

declare global {
  // eslint-disable-next-line no-var
  var metricsMemoryCache:
    | Map<string, { value: unknown; expiresAt: number }>
    | undefined;
}

// Mock Redis
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();

vi.mock("@upstash/redis", () => {
  return {
    Redis: vi.fn(() => ({
      get: mockRedisGet,
      set: mockRedisSet,
    })),
  };
});

describe("metrics-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete globalThis.metricsMemoryCache;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  describe("metricsCacheKey", () => {
    it("verify key format includes userId, endpoint, and params", () => {
      const key = metricsCacheKey("user123", "activity", { year: 2023 });
      expect(key).toBe("metrics:user123:activity:year=2023");
    });

    it("verify params are sorted and serialized", () => {
      const key1 = metricsCacheKey("user123", "activity", { b: 2, a: 1 });
      const key2 = metricsCacheKey("user123", "activity", { a: 1, b: 2 });

      expect(key1).toBe("metrics:user123:activity:a=1&b=2");
      expect(key2).toBe("metrics:user123:activity:a=1&b=2");
    });
  });

  describe("isMetricsCacheBypassed", () => {
    it("verify refresh, bypassCache, and sync params", () => {
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?refresh=true"))
      ).toBe(true);
      expect(
        isMetricsCacheBypassed(
          new NextRequest("http://localhost?bypassCache=1")
        )
      ).toBe(true);
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?sync=yes"))
      ).toBe(true);
      expect(
        isMetricsCacheBypassed(
          new NextRequest("http://localhost?refresh=false")
        )
      ).toBe(false);
    });

    it("verify x-devtrack-cache-bypass header", () => {
      const req = new NextRequest("http://localhost", {
        headers: new Headers({ "x-devtrack-cache-bypass": "on" }),
      });
      expect(isMetricsCacheBypassed(req)).toBe(true);
    });

    it("verify non-bypass values are rejected", () => {
      expect(
        isMetricsCacheBypassed(
          new NextRequest("http://localhost?refresh=false")
        )
      ).toBe(false);
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?refresh=0"))
      ).toBe(false);
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?refresh=no"))
      ).toBe(false);
      expect(
        isMetricsCacheBypassed(
          new NextRequest("http://localhost?bypassCache=off")
        )
      ).toBe(false);
    });

    it("verify missing parameters do not bypass", () => {
      expect(isMetricsCacheBypassed(new NextRequest("http://localhost"))).toBe(
        false
      );
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?other=value"))
      ).toBe(false);
    });

    it("verify case insensitive bypass values", () => {
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?refresh=TRUE"))
      ).toBe(true);
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?refresh=YES"))
      ).toBe(true);
      expect(
        isMetricsCacheBypassed(new NextRequest("http://localhost?refresh=ON"))
      ).toBe(true);
    });

    it("verify combination of query param and header bypass", () => {
      const req = new NextRequest("http://localhost?refresh=true", {
        headers: new Headers({ "x-devtrack-cache-bypass": "1" }),
      });
      expect(isMetricsCacheBypassed(req)).toBe(true);
    });
  });

  describe("cacheGet/cacheSet", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("verify TTL expiration logic", async () => {
      await cacheSet("test-ttl-key", "data", 10);
      expect(await cacheGet("test-ttl-key")).toBe("data");

      vi.advanceTimersByTime(11000);

      expect(await cacheGet("test-ttl-key")).toBeNull();
    });

    it("verify MAX_CACHE_ENTRIES bound", async () => {
      for (let i = 0; i < 505; i++) {
        await cacheSet(`key-${i}`, `val-${i}`, 60);
      }

      expect(await cacheGet("key-0")).toBeNull();
      expect(await cacheGet("key-504")).toBe("val-504");
    });

    it("verify invalid TTL values are handled", async () => {
      await cacheSet("invalid-1", "data", -5);
      expect(await cacheGet("invalid-1")).toBeNull();

      await cacheSet("invalid-2", "data", NaN);
      expect(await cacheGet("invalid-2")).toBeNull();

      await cacheSet("invalid-3", "data", 0);
      expect(await cacheGet("invalid-3")).toBeNull();
    });
    it("deletes both fresh and stale cache entries", async () => {
      const key = "delete-with-stale-key";
      const staleKey = `${key}:stale`;

      await cacheSet(key, "fresh-data", 60);
      await cacheSet(staleKey, "stale-data", 3600);

      expect(await cacheGet(key)).toBe("fresh-data");
      expect(await cacheGet(staleKey)).toBe("stale-data");

      await cacheDelete(key);

      expect(await cacheGet(key)).toBeNull();
      expect(await cacheGet(staleKey)).toBeNull();
    });
  });

  describe("withMetricsCache", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("verify bypass skips cache", async () => {
      let loadCount = 0;
      const loadFresh = async () => {
        loadCount++;
        return "fresh-data";
      };

      const options = { bypass: true, key: "bypass-key", ttlSeconds: 60 };

      await withMetricsCache(options, loadFresh);
      expect(loadCount).toBe(1);

      await withMetricsCache(options, loadFresh);
      expect(loadCount).toBe(2);

      options.bypass = false;
      const val = await withMetricsCache(options, loadFresh);
      expect(val).toBe("fresh-data");
      expect(loadCount).toBe(2);
    });

    it("verify fallback to loadFresh on cache miss", async () => {
      const loadFresh = vi.fn().mockResolvedValue("new-data");
      const options = { bypass: false, key: "miss-key", ttlSeconds: 60 };

      const val1 = await withMetricsCache(options, loadFresh);
      expect(val1).toBe("new-data");
      expect(loadFresh).toHaveBeenCalledTimes(1);

      const val2 = await withMetricsCache(options, loadFresh);
      expect(val2).toBe("new-data");
      expect(loadFresh).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(61000);
      const val3 = await withMetricsCache(options, loadFresh);
      expect(val3).toBe("new-data");
      expect(loadFresh).toHaveBeenCalledTimes(2);
    });
    it("returns stale data when refresh fails with an approved error", async () => {
      const rateLimitError = new Error("GitHub rate limit exceeded");
      rateLimitError.name = "GitHubRateLimitError";

      const options = {
        bypass: false,
        key: "stale-rate-limit-key",
        ttlSeconds: 60,
        staleGraceSeconds: 3600,
        fallbackToStaleOnError: (error: unknown) =>
          error instanceof Error && error.name === "GitHubRateLimitError",
      };

      const firstLoader = vi.fn().mockResolvedValue("cached-data");

      await expect(withMetricsCache(options, firstLoader)).resolves.toBe(
        "cached-data"
      );

      vi.advanceTimersByTime(61_000);

      const failingLoader = vi.fn().mockRejectedValue(rateLimitError);

      await expect(withMetricsCache(options, failingLoader)).resolves.toBe(
        "cached-data"
      );

      expect(failingLoader).toHaveBeenCalledTimes(1);
    });

    it("does not return stale data for unrelated errors", async () => {
      const options = {
        bypass: false,
        key: "stale-unrelated-error-key",
        ttlSeconds: 60,
        staleGraceSeconds: 3600,
        fallbackToStaleOnError: (error: unknown) =>
          error instanceof Error && error.name === "GitHubRateLimitError",
      };

      await withMetricsCache(options, vi.fn().mockResolvedValue("cached-data"));

      vi.advanceTimersByTime(61_000);

      await expect(
        withMetricsCache(
          options,
          vi.fn().mockRejectedValue(new Error("database unavailable"))
        )
      ).rejects.toThrow("database unavailable");
    });

    it("does not use stale data when cache bypass is requested", async () => {
      const rateLimitError = new Error("GitHub rate limit exceeded");
      rateLimitError.name = "GitHubRateLimitError";

      const options = {
        bypass: false,
        key: "stale-bypass-key",
        ttlSeconds: 60,
        staleGraceSeconds: 3600,
        fallbackToStaleOnError: (error: unknown) =>
          error instanceof Error && error.name === "GitHubRateLimitError",
      };

      await withMetricsCache(options, vi.fn().mockResolvedValue("cached-data"));

      vi.advanceTimersByTime(61_000);

      await expect(
        withMetricsCache(
          { ...options, bypass: true },
          vi.fn().mockRejectedValue(rateLimitError)
        )
      ).rejects.toThrow("GitHub rate limit exceeded");
    });
  });
});
