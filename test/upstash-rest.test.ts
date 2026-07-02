import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getUpstashConfig } from "../src/lib/upstash-rest";

describe("upstash-rest", () => {
  describe("getUpstashConfig", () => {
    beforeEach(() => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });
    afterEach(() => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });
    it("returns null when URL is missing", () => {
      process.env.UPSTASH_REDIS_REST_TOKEN = "some-token";
      expect(getUpstashConfig()).toBeNull();
    });
    it("returns null when token is missing", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://some.upstash.io";
      expect(getUpstashConfig()).toBeNull();
    });
    it("returns null when both missing", () => { expect(getUpstashConfig()).toBeNull(); });
    it("returns null when URL is empty", () => {
      process.env.UPSTASH_REDIS_REST_URL = "";
      process.env.UPSTASH_REDIS_REST_TOKEN = "some-token";
      expect(getUpstashConfig()).toBeNull();
    });
    it("returns null when token is empty", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://some.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "";
      expect(getUpstashConfig()).toBeNull();
    });
    it("returns null when both empty", () => {
      process.env.UPSTASH_REDIS_REST_URL = "";
      process.env.UPSTASH_REDIS_REST_TOKEN = "";
      expect(getUpstashConfig()).toBeNull();
    });
    it("returns url and token when both set", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://my-db.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "my-secret-token";
      expect(getUpstashConfig()).toEqual({ url: "https://my-db.upstash.io", token: "my-secret-token" });
    });
    it("preserves exact values", () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://special-chars.upstash.io:443";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token_with_underscores_and-dashes";
      const config = getUpstashConfig();
      expect(config?.url).toBe("https://special-chars.upstash.io:443");
      expect(config?.token).toBe("token_with_underscores_and-dashes");
    });
  });
});