import type { NextRequest } from "next/server";

export type MemoryRateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number; // unix seconds
};

function normalizeIp(value: string | null | undefined): string | null {
  const ip = typeof value === "string" ? value.trim() : "";
  return ip.length > 0 ? ip : null;
}

export function getClientIp(
  req: Pick<NextRequest, "headers">
): string {
  return (
    normalizeIp(req.headers.get("cf-connecting-ip")) ??
    normalizeIp(req.headers.get("x-real-ip")) ??
    normalizeIp(req.headers.get("x-forwarded-for")?.split(",")[0]) ??
    "unknown"
  );
}

type Bucket = { count: number; resetAt: number };

export function createMemoryFixedWindowRateLimiter(options: {
  windowMs: number;
  pruneIntervalMs?: number;
  maxEntries?: number;
}) {
  const windowMs = options.windowMs;
  const pruneIntervalMs = options.pruneIntervalMs ?? windowMs;
  const maxEntries = options.maxEntries ?? 10_000;

  const buckets = new Map<string, Bucket>();
  let lastPruneAt = 0;

  function prune(now: number) {
    if (now - lastPruneAt < pruneIntervalMs) return;
    lastPruneAt = now;

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }

    if (buckets.size <= maxEntries) return;

    const overflow = buckets.size - maxEntries;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }

  function check(
    key: string,
    limit: number,
    now = Date.now()
  ): MemoryRateLimitResult {
    prune(now);

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        reset: Math.ceil((now + windowMs) / 1000),
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        reset: Math.ceil(existing.resetAt / 1000),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(limit - existing.count, 0),
      reset: Math.ceil(existing.resetAt / 1000),
    };
  }

  return { check, _unsafeBuckets: buckets };
}

// Optimized rate limiting handling for third-party integrations
export const RATE_LIMIT_RETRIES = 3;
export const RATE_LIMIT_BACKOFF_MS = 1000;
