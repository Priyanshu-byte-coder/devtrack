import { describe, it, expect } from "vitest";

import {
  getUpstashConfig,
  upstashRateLimitFixedWindow,
  upstashTryAcquireLock,
} from "../src/lib/upstash-rest.ts";

describe("upstash-rest", () => {
it("getUpstashConfig returns null when env is missing", () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  expect(getUpstashConfig()).toBe(null);
});

it("getUpstashConfig returns { url, token } when both env vars are set", () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  expect(getUpstashConfig()).toEqual({
    url: "https://example.upstash.io",
    token: "test-token",
  });
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

it("getUpstashConfig returns null when either env var is an empty string", () => {
  process.env.UPSTASH_REDIS_REST_URL = "";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  expect(getUpstashConfig()).toBe(null);

  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "";
  expect(getUpstashConfig()).toBe(null);

  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

it("upstashRateLimitFixedWindow sets expiry for new buckets", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  const originalFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = async (url, init) => {
    call += 1;
    expect(String(url).includes("/pipeline")).toBe(true);
    const body = JSON.parse(init.body);
    if (call === 1) {
      expect(body).toEqual([
        ["INCR", "k"],
        ["TTL", "k"],
      ]);
      return {
        ok: true,
        async json() {
          return [{ result: 1 }, { result: -1 }];
        },
      };
    }
    expect(body).toEqual([["EXPIRE", "k", 60]]);
    return {
      ok: true,
      async json() {
        return [{ result: 1 }];
      },
    };
  };
  try {
    const result = await upstashRateLimitFixedWindow({
      key: "k",
      limit: 20,
      windowSeconds: 60,
    });
    expect(result).toEqual({ allowed: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("upstashRateLimitFixedWindow returns retryAfter from TTL", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return [{ result: 21 }, { result: 10 }];
    },
  });
  try {
    const result = await upstashRateLimitFixedWindow({
      key: "k2",
      limit: 20,
      windowSeconds: 60,
    });
    expect(result).toEqual({ allowed: false, retryAfter: 10 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("upstashTryAcquireLock returns true only when SET succeeds", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  const originalFetch = globalThis.fetch;
  let returnedOk = false;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      returnedOk = !returnedOk;
      return [{ result: returnedOk ? "OK" : null }];
    },
  });
  try {
    expect(
      await upstashTryAcquireLock({ key: "lock", ttlSeconds: 30 })
    ).toBe(true);
    expect(
      await upstashTryAcquireLock({ key: "lock", ttlSeconds: 30 })
    ).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
});