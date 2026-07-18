import { NextRequest } from "next/server";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CONTACT_LIMIT = 3;

// NOTE: In-memory store for rate limiting contact form submissions.
// Extends edge/serverless rate limiting with specific IP-based hour windows.
export const contactBuckets = new Map<string, number[]>();

export type ContactRateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

function pruneBuckets(now: number) {
  if (contactBuckets.size < 500) return;
  const cutoff = now - WINDOW_MS;
  for (const [key, timestamps] of Array.from(contactBuckets.entries())) {
    if (timestamps.every((t) => t <= cutoff)) {
      contactBuckets.delete(key);
    }
  }
}

export function checkContactRateLimit(ip: string): ContactRateLimitResult {
  const now = Date.now();
  pruneBuckets(now);

  const key = `contact:${ip}`;
  const cutoff = now - WINDOW_MS;
  const active = (contactBuckets.get(key) ?? []).filter((t) => t > cutoff);
  const reset = Math.ceil(((active[0] ?? now) + WINDOW_MS) / 1000);

  if (active.length >= CONTACT_LIMIT) {
    contactBuckets.set(key, active);
    return { allowed: false, remaining: 0, reset };
  }

  active.push(now);
  contactBuckets.set(key, active);
  return { allowed: true, remaining: CONTACT_LIMIT - active.length, reset };
}

export function getContactClientIp(req: NextRequest): string {
  return (
    (req as any).ip ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
