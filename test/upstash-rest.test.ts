import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getUpstashConfig } from "../src/lib/upstash-rest";

describe("upstash-rest", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    // Restore globalThis.fetch if it was mocked
    if ((globalThis as any)._originalFetch) {
      globalThis.fetch = (globalThis as any)._originalFetch;
      delete (globalThis as any)._originalFetch;
    }
  });

  describe("getUpstashConfig", () => {
    it("returns null when UPSTASH_REDIS_REST_URL is missing", () => {
      process.env.UPSTASH_REDIS_REST_TOKEN = "some-token";
      expect(getUpstashConfig()).toBeNull();
    });

    it("returns null when UPSTASH_REDIS_REST_TOKEN is missing", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
      expect(getUpstashConfig()).toBeNull();
    });

    it("returns null when both env vars are missing", () => {
      expect(getUpstashConfig()).toBeNull();
    });

    it("returns config object when both env vars are set", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "my-token";
      const config = getUpstashConfig();
      expect(config).toEqual({
        url: "https://example.upstash.io",
        token: "my-token",
      });
    });

    it("returns config with correct structure", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://api.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token123";
      const config = getUpstashConfig();
      expect(config).toHaveProperty("url");
      expect(config).toHaveProperty("token");
      expect(config!.url).toBe("https://api.upstash.io");
      expect(config!.token).toBe("token123");
    });
  });
});
