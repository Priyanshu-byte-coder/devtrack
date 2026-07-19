import assert from "node:assert/strict";
import test from "node:test";

import {
  pruneExpiredLeaderboardCache,
  pruneExpiredRateLimits,
} from "../src/lib/leaderboard-cache.ts";

test("pruneExpiredRateLimits removes only expired IP buckets", () => {
  const buckets = new Map([
    ["expired", { count: 20, resetAt: 1_000 }],
    ["active", { count: 2, resetAt: 5_000 }],
  ]);

  pruneExpiredRateLimits(buckets, 2_000);

  assert.equal(buckets.has("expired"), false);
  assert.deepEqual(buckets.get("active"), { count: 2, resetAt: 5_000 });
});

test("pruneExpiredLeaderboardCache clears stale leaderboard payloads", () => {
  const cache = {
    expiresAt: 1_000,
    payload: { ok: true },
  };

  assert.equal(pruneExpiredLeaderboardCache(cache, 1_001), null);
});

test("pruneExpiredLeaderboardCache clears entries that expire exactly at now", () => {
  const cache = {
    expiresAt: 1_000,
    payload: { ok: true },
  };

  assert.equal(pruneExpiredLeaderboardCache(cache, 1_000), null);
});

test("pruneExpiredLeaderboardCache returns null for a missing cache entry", () => {
  assert.equal(pruneExpiredLeaderboardCache(null, 1_000), null);
});

test("pruneExpiredLeaderboardCache keeps fresh leaderboard payloads", () => {
  const cache = {
    expiresAt: 2_000,
    payload: { ok: true },
  };

  assert.equal(pruneExpiredLeaderboardCache(cache, 1_999), cache);
});

test("pruneExpiredLeaderboardCache keeps far-future entries untouched", () => {
  const cache = {
    expiresAt: Number.MAX_SAFE_INTEGER,
    payload: { rows: [1, 2, 3] },
  };

  assert.equal(pruneExpiredLeaderboardCache(cache, 1_000), cache);
});

test("pruneExpiredLeaderboardCache preserves payload shape for primitive values", () => {
  const cache = {
    expiresAt: 5_000,
    payload: "leaderboard-json",
  };

  assert.equal(pruneExpiredLeaderboardCache(cache, 4_999), cache);
  assert.equal(pruneExpiredLeaderboardCache(cache, 5_000), null);
});
