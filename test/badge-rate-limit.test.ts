import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkBadgeRateLimit, getBadgeClientIp } from '../src/lib/badge-rate-limit';
import { NextRequest } from 'next/server';

describe('badge-rate-limit', () => {
  describe('checkBadgeRateLimit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('verify 20 requests per minute limit per IP', () => {
      const ip = '1.2.3.4';
      for (let i = 0; i < 20; i++) {
        const result = checkBadgeRateLimit(ip);
        expect(result.allowed).toBe(true);
      }
      const result = checkBadgeRateLimit(ip);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets counter after window expires', () => {
      const ip = 'reset-test';
    
      for (let i = 0; i < 20; i++) {
        checkBadgeRateLimit(ip);
      }
    
      expect(checkBadgeRateLimit(ip).allowed).toBe(false);
    
      vi.advanceTimersByTime(120000);
    
      const result = checkBadgeRateLimit(ip);
    
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it('verify remaining count decrements correctly', () => {
      const ip = '2.3.4.5';
      const r1 = checkBadgeRateLimit(ip);
      expect(r1.remaining).toBe(19);
      const r2 = checkBadgeRateLimit(ip);
      expect(r2.remaining).toBe(18);
    });

    it('verify reset time points to the end of the current window', () => {
      const ip = '3.4.5.6';
      // t=1000ms falls in the window [0, 60000), so it ends at 60000ms = epoch second 60.
      vi.setSystemTime(new Date(1000));
      const result = checkBadgeRateLimit(ip);
      expect(result.reset).toBe(60);
    });

    it('verify bucket pruning works when size exceeds 500', () => {
      // Fill the store to exceed the 500 limit.
      vi.setSystemTime(new Date(1000));
      for (let i = 0; i < 505; i++) {
        checkBadgeRateLimit(`prune-ip-${i}`);
      }

      // Advance time by 61 seconds so the 505 entries are in an expired window.
      vi.advanceTimersByTime(61000);

      // Next call triggers pruneStore and removes stale entries; should succeed.
      const result = checkBadgeRateLimit('new-ip');
      expect(result.allowed).toBe(true);
    });

    // ── sliding window counter semantics ────────────────────────────────────

    it('allows all requests within the limit in a single window', () => {
      const ip = 'single-window-ip';
      vi.setSystemTime(new Date(0));
      for (let i = 0; i < 20; i++) {
        expect(checkBadgeRateLimit(ip).allowed).toBe(true);
      }
      expect(checkBadgeRateLimit(ip).allowed).toBe(false);
    });

    it('previous window requests reduce capacity in the new window (sliding effect)', () => {
      const ip = 'sliding-ip';
      // Fill 18 requests in window [0, 60000).
      vi.setSystemTime(new Date(0));
      for (let i = 0; i < 18; i++) {
        checkBadgeRateLimit(ip);
      }

      // Advance to 30 s into the next window.
      // prevWeight = 1 - 30000/60000 = 0.5; estimate from prev = floor(18*0.5) = 9.
      vi.setSystemTime(new Date(90_000)); // windowStart=60000, elapsed=30000

      // With estimate=9 from prev, capacity left = 20-9 = 11 more requests.
      for (let i = 0; i < 11; i++) {
        expect(checkBadgeRateLimit(ip).allowed).toBe(true);
      }
      // 12th would put currCount at 12, estimate=9+12=21 >= 20 → denied.
      expect(checkBadgeRateLimit(ip).allowed).toBe(false);
    });

    it('requests from two or more windows ago do not count', () => {
      const ip = 'two-window-ip';
      // Max out in window 0.
      vi.setSystemTime(new Date(0));
      for (let i = 0; i < 20; i++) {
        checkBadgeRateLimit(ip);
      }

      // Advance past two full windows — history is completely stale.
      vi.setSystemTime(new Date(121_000)); // windowStart=120000
      const result = checkBadgeRateLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
    });

    it('returns 429-compatible status (remaining 0) when limit is hit', () => {
      const ip = 'block-check-ip';
      vi.setSystemTime(new Date(0));
      for (let i = 0; i < 20; i++) {
        checkBadgeRateLimit(ip);
      }
      const blocked = checkBadgeRateLimit(ip);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.reset).toBeGreaterThan(0);
    });

    it('reset field advances with the window boundary', () => {
      const ip = 'reset-boundary-ip';
      // Window [0, 60000) → reset = 60
      vi.setSystemTime(new Date(1000));
      const r1 = checkBadgeRateLimit(ip);
      expect(r1.reset).toBe(60);

      // Window [60000, 120000) → reset = 120
      vi.setSystemTime(new Date(61_000));
      const r2 = checkBadgeRateLimit(ip);
      expect(r2.reset).toBe(120);
    });

    it('no timestamp arrays — entry stores only two counters and a window start', () => {
      // Behavioural proxy: make requests spread across two windows and confirm
      // the counter semantics hold (an array implementation would behave differently
      // once timestamps fall outside the sliding window).
      const ip = 'counter-shape-ip';
      vi.setSystemTime(new Date(0));
      for (let i = 0; i < 15; i++) {
        checkBadgeRateLimit(ip);
      }
      // Start of a new window — prev 15 contribute with weight 1 initially.
      vi.setSystemTime(new Date(60_000));
      // elapsed=0, prevWeight=1, estimate=floor(15*1)+0=15 → 5 remaining.
      for (let i = 0; i < 5; i++) {
        expect(checkBadgeRateLimit(ip).allowed).toBe(true);
      }
      // 6th request: estimate=15+5=20 >= 20 → denied.
      expect(checkBadgeRateLimit(ip).allowed).toBe(false);
    });
  });

  describe('getBadgeClientIp', () => {
    it('verify x-forwarded-for header parsing', () => {
      const req = {
        headers: new Headers({
          'x-forwarded-for': '192.168.1.1, 10.0.0.1'
        })
      } as unknown as NextRequest;

      expect(getBadgeClientIp(req)).toBe('192.168.1.1');
    });

    it('verify x-real-ip header handling', () => {
      const req = {
        headers: new Headers({
          'x-real-ip': '10.0.0.2'
        })
      } as unknown as NextRequest;

      expect(getBadgeClientIp(req)).toBe('10.0.0.2');
    });

    it('verify fallback to "unknown" when no IP available', () => {
      const req = {
        headers: new Headers()
      } as unknown as NextRequest;

      expect(getBadgeClientIp(req)).toBe('unknown');
    });

    it('verify req.ip is used if present', () => {
      const req = {
        ip: '172.16.0.1',
        headers: new Headers()
      } as unknown as NextRequest;

      expect(getBadgeClientIp(req)).toBe('172.16.0.1');
    });

    it('x-forwarded-for takes precedence over req.ip', () => {
      const req = {
        ip: '10.0.0.99',
        headers: new Headers({
          'x-forwarded-for': '203.0.113.5'
        })
      } as unknown as NextRequest;

      expect(getBadgeClientIp(req)).toBe('203.0.113.5');
    });
  });
});
