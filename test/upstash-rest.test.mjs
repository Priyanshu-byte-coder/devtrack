import assert from "node:assert/strict";
import test from "node:test";

import {
  getUpstashConfig,
  upstashRateLimitFixedWindow,
  upstashTryAcquireLock,
} from "../src/lib/upstash-rest.ts";

test("getUpstashConfig returns null when env is missing", () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(getUpstashConfig(), null);
});

test("getUpstashConfig returns { url, token } when both env vars are set", () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  assert.deepEqual(getUpstashConfig(), {
    url: "https://example.upstash.io",
    token: "test-token",
  });
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test("getUpstashConfig returns null when either env var is an empty string", () => {
  process.env.UPSTASH_REDIS_REST_URL = "";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  assert.equal(getUpstashConfig(), null);

  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "";
  assert.equal(getUpstashConfig(), null);

  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test("upstashRateLimitFixedWindow sets expiry for new buckets", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  const originalFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = async (url, init) => {
    call += 1;
    assert.ok(String(url).includes("/pipeline"));
    const body = JSON.parse(init.body);
    if (call === 1) {
      assert.deepEqual(body, [["INCR", "k"], ["TTL", "k"]]);
      return {
        ok: true,
        async json() {
          return [{ result: 1 }, { result: -1 }];
        },
      };
    }
    assert.deepEqual(body, [["EXPIRE", "k", 60]]);
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
    assert.deepEqual(result, { allowed: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("upstashRateLimitFixedWindow returns retryAfter from TTL", async () => {
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
    assert.deepEqual(result, { allowed: false, retryAfter: 10 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("upstashTryAcquireLock returns true only when SET succeeds", async () => {
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
    assert.equal(await upstashTryAcquireLock({ key: "lock", ttlSeconds: 30 }), true);
    assert.equal(await upstashTryAcquireLock({ key: "lock", ttlSeconds: 30 }), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
