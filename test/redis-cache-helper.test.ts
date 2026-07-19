import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("redis-cache-helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCachedData", () => {
    it("should return null when redis is not configured", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const { getCachedData } = await import("../src/lib/redis-cache-helper");
      const result = await getCachedData("test-key");

      expect(result).toBeNull();
    });

    it("should return null on cache read error", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      const mockGet = vi.fn().mockRejectedValue(new Error("Redis error"));
      vi.doMock("@upstash/redis", () => ({
        Redis: vi.fn().mockImplementation(function () {
          return {
            get: mockGet,
            set: vi.fn(),
          };
        }),
      }));

      const { getCachedData } = await import("../src/lib/redis-cache-helper");
      const result = await getCachedData("test-key");

      expect(result).toBeNull();
    });

    it("should return null for non-existent key", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      const mockGet = vi.fn().mockResolvedValue(null);
      vi.doMock("@upstash/redis", () => ({
        Redis: vi.fn().mockImplementation(function () {
          return {
            get: mockGet,
            set: vi.fn(),
          };
        }),
      }));

      const { getCachedData } = await import("../src/lib/redis-cache-helper");
      const result = await getCachedData("non-existent-key");

      expect(result).toBeNull();
    });
  });

  describe("setCachedData", () => {
    it("should return early when redis is not configured", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const { setCachedData } = await import("../src/lib/redis-cache-helper");
      await expect(setCachedData("test-key", "test-value")).resolves.toBeUndefined();
    });

    it("should handle cache write error gracefully", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      const mockSet = vi.fn().mockRejectedValue(new Error("Redis write error"));
      vi.doMock("@upstash/redis", () => ({
        Redis: vi.fn().mockImplementation(function () {
          return {
            get: vi.fn(),
            set: mockSet,
          };
        }),
      }));

      const { setCachedData } = await import("../src/lib/redis-cache-helper");
      await expect(setCachedData("test-key", "test-value")).resolves.toBeUndefined();
    });
  });
});