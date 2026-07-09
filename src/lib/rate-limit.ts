import type { NextRequest } from "next/server";

export type MemoryRateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

function normalizeIp(value: string | null | undefined): string | null {
  const ip = typeof value === "string" ? value.trim() : "";
  return ip.length > 0 ? ip : null;
}

/**
 * Which proxy infrastructure is in front of this deployment.
 *
 * - "vercel"     — Vercel Edge terminates the connection; x-real-ip and
 *                  x-forwarded-for are set by Vercel itself and cannot be
 *                  spoofed by the client. Safe to trust when VERCEL=1.
 * - "cloudflare" — cf-connecting-ip is set by Cloudflare. Safe to trust
 *                  when the request actually comes through Cloudflare.
 * - "none"       — No trusted proxy. All forwarding headers are ignored;
 *                  falls back to "unknown" to avoid spoofing.
 *
 * Set TRUSTED_PROXY in your environment. Defaults to "vercel" when the
 * VERCEL env var is present (set automatically by Vercel), otherwise "none".
 */
function getTrustedProxy(): "vercel" | "cloudflare" | "none" {
  const raw = process.env.TRUSTED_PROXY;
  if (raw === "vercel" || raw === "cloudflare" || raw === "none") return raw;
  // Auto-detect: if running on Vercel infra, trust Vercel's headers
  if (process.env.VERCEL === "1") return "vercel";
  return "none";
}

/**
 * Returns the real client IP, taking into account which proxy is trusted.
 *
 * SECURITY: Never trust forwarding headers from an untrusted source.
 * An attacker can set x-forwarded-for / x-real-ip / cf-connecting-ip to
 * any value they want on a direct request, defeating IP-based rate limiting.
 * This function only reads those headers when the deployment is configured
 * to trust the proxy that sets them.
 */
export function getClientIp(req: Pick<NextRequest, "headers">): string {
  const proxy = getTrustedProxy();

  if (proxy === "vercel") {
    // Vercel sets x-real-ip to the actual client IP at the edge.
    // x-forwarded-for is also set by Vercel but may contain multiple hops.
    return (
      normalizeIp(req.headers.get("x-real-ip")) ??
      normalizeIp(req.headers.get("x-forwarded-for")?.split(",")[0]) ??
      "unknown"
    );
  }

  if (proxy === "cloudflare") {
    // cf-connecting-ip is set by Cloudflare to the original client IP.
    return (
      normalizeIp(req.headers.get("cf-connecting-ip")) ??
      normalizeIp(req.headers.get("x-real-ip")) ??
      "unknown"
    );
  }

  // proxy === "none": no trusted proxy configured.
  // Do NOT read any forwarding headers — they are client-controlled.
  // Log a dev warning so misconfigured deployments are caught early.
  if (process.env.NODE_ENV === "development") {
    const hasForwardingHeader =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("cf-connecting-ip");
    if (hasForwardingHeader) {
      console.warn(
        "[rate-limit] Forwarding header present but TRUSTED_PROXY is not set. " +
        "Set TRUSTED_PROXY=vercel or TRUSTED_PROXY=cloudflare in your environment. " +
        "Falling back to 'unknown' to prevent IP spoofing."
      );
    }
  }

  return "unknown";
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