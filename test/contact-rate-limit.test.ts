import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkContactRateLimit, getContactClientIp, contactBuckets } from "../src/lib/contact-rate-limit";
import { NextRequest } from "next/server";

describe("contact-rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    contactBuckets.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkContactRateLimit", () => {
    it("verify 3 requests per hour limit per IP", () => {
      const ip = "1.2.3.4";
      
      // First request
      const r1 = checkContactRateLimit(ip);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      // Second request
      const r2 = checkContactRateLimit(ip);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      // Third request
      const r3 = checkContactRateLimit(ip);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // Fourth request (blocked)
      const r4 = checkContactRateLimit(ip);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
    });

    it("verify reset time is calculated correctly (1 hour window)", () => {
      const ip = "3.4.5.6";
      vi.setSystemTime(new Date(1000 * 1000)); // Set system time to 1000 seconds past epoch
      
      const result = checkContactRateLimit(ip);
      // Window is 1 hour (3600s), so reset time should be exactly 1000 + 3600 = 4600s
      expect(result.reset).toBe(4600);
    });

    it("verify rate limit resets after window expires", () => {
      const ip = "5.6.7.8";
      
      // Exhaust 3 requests
      checkContactRateLimit(ip);
      checkContactRateLimit(ip);
      checkContactRateLimit(ip);
      
      const rBlocked = checkContactRateLimit(ip);
      expect(rBlocked.allowed).toBe(false);

      // Fast forward system time by 1 hour and 1 second
      vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

      const rAllowed = checkContactRateLimit(ip);
      expect(rAllowed.allowed).toBe(true);
      expect(rAllowed.remaining).toBe(2);
    });

    it("verify bucket pruning works when size exceeds 500", () => {
      vi.setSystemTime(new Date(1000));
      // Populate 505 buckets
      for (let i = 0; i < 505; i++) {
        checkContactRateLimit(`prune-ip-${i}`);
      }

      expect(contactBuckets.size).toBe(505);

      // Fast forward time by 1 hour and 1 second
      vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

      // Make a new request to trigger pruning
      const result = checkContactRateLimit("new-ip");
      expect(result.allowed).toBe(true);
      // Expect expired buckets to be pruned
      expect(contactBuckets.size).toBe(1); // 'new-ip' (all 505 older ones are expired and pruned, plus new-ip added = 1).
    });
  });

  describe("getContactClientIp", () => {
    it("verify x-forwarded-for header parsing", () => {
      const req = {
        headers: new Headers({
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
        }),
      } as unknown as NextRequest;

      expect(getContactClientIp(req)).toBe("192.168.1.1");
    });

    it("verify x-real-ip header handling", () => {
      const req = {
        headers: new Headers({
          "x-real-ip": "10.0.0.2",
        }),
      } as unknown as NextRequest;

      expect(getContactClientIp(req)).toBe("10.0.0.2");
    });

    it("verify fallback to 'unknown' when no IP available", () => {
      const req = {
        headers: new Headers(),
      } as unknown as NextRequest;

      expect(getContactClientIp(req)).toBe("unknown");
    });

    it("verify req.ip is used if present", () => {
      const req = {
        ip: "172.16.0.1",
        headers: new Headers(),
      } as unknown as NextRequest;

      expect(getContactClientIp(req)).toBe("172.16.0.1");
    });
  });
});
