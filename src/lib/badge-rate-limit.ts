import { NextRequest } from "next/server";

const WINDOW_MS = 60 * 1000;
const BADGE_LIMIT = 20;

// Sliding window counter entry — O(1) per client instead of O(N) timestamps.
type Entry = {
  prevCount: number;   // requests counted in the previous window
  currCount: number;   // requests counted in the current window
  windowStart: number; // epoch ms, quantized to WINDOW_MS boundaries
};

const store = new Map<string, Entry>();

export type BadgeRateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

let lastPrune = Date.now();

function pruneStore(now: number): void {
  if (store.size < 500) return;
  if (now - lastPrune < 60000) return; // Only prune once per minute
  lastPrune = now;
  const cutoff = now - WINDOW_MS;
  for (const [key, entry] of store) {
    if (entry.windowStart < cutoff) store.delete(key);
  }
}

export function checkBadgeRateLimit(ip: string): BadgeRateLimitResult {
  const now = Date.now();
  pruneStore(now);

  const key = `badge:${ip}`;
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const reset = Math.ceil((windowStart + WINDOW_MS) / 1000);

  let entry = store.get(key);

  if (!entry || entry.windowStart < windowStart - WINDOW_MS) {
    entry = { prevCount: 0, currCount: 0, windowStart };
  } else if (entry.windowStart < windowStart) {
    entry = { prevCount: entry.currCount, currCount: 0, windowStart };
  }

  const elapsed = now - windowStart;
  const prevWeight = 1 - elapsed / WINDOW_MS;
  const estimate = Math.floor(entry.prevCount * prevWeight) + entry.currCount;

  if (estimate >= BADGE_LIMIT) {
    store.set(key, entry);
    return { allowed: false, remaining: 0, reset };
  }

  entry = { ...entry, currCount: entry.currCount + 1 };
  store.set(key, entry);
  const remaining = Math.max(
    0,
    BADGE_LIMIT - Math.floor(entry.prevCount * prevWeight) - entry.currCount
  );
  return { allowed: true, remaining, reset };
}

export function getBadgeClientIp(req: NextRequest): string {
  // Use Vercel's trusted IP header or fallback to connection IP
  // Do NOT blindly trust x-forwarded-for as it can be easily spoofed
  return (
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    (req as NextRequest & { ip?: string }).ip ||
    "unknown"
  );
}
