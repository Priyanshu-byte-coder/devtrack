import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase admin client so we control the stored timezone lookup.
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock badge rate limiting so tests always pass through.
vi.mock("@/lib/badge-rate-limit", () => ({
  checkBadgeRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 19,
    reset: Math.floor(Date.now() / 1000) + 60,
  })),
  getBadgeClientIp: vi.fn(() => "127.0.0.1"),
}));

// Mock the canonical streak calculator so we can assert on the timeZone
// argument it receives, without needing real commit data.
vi.mock("@/lib/streak", () => ({
  calculateStreakFromDates: vi.fn(() => ({
    current: 3,
    longest: 5,
    lastCommitDate: "2026-07-01",
    totalActiveDays: 10,
    freezeDates: [],
  })),
}));

import { supabaseAdmin } from "@/lib/supabase";
import { calculateStreakFromDates } from "@/lib/streak";
import { GET } from "@/app/api/badge/streak-shield/route";

function mockFetchCommits() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [{ commit: { author: { date: "2026-07-01T09:00:00Z" } } }],
    }),
  }) as unknown as typeof fetch;
}

describe("streak-shield badge timezone handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCommits();
  });

  it("passes the user's stored timezone to calculateStreakFromDates instead of defaulting to UTC", async () => {
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { timezone: "America/Los_Angeles" },
        error: null,
      }),
    });

    const req = new NextRequest(
      "https://devtrack.example/api/badge/streak-shield?user=octocat"
    );
    await GET(req);

    expect(calculateStreakFromDates).toHaveBeenCalledWith(
      expect.any(Set),
      expect.any(Set),
      "America/Los_Angeles"
    );
  });

  it("falls back to UTC when the user has no DevTrack account or timezone set", async () => {
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = new NextRequest(
      "https://devtrack.example/api/badge/streak-shield?user=unknown-user"
    );
    await GET(req);

    expect(calculateStreakFromDates).toHaveBeenCalledWith(
      expect.any(Set),
      expect.any(Set),
      "UTC"
    );
  });

  it("falls back to UTC gracefully when the timezone lookup throws", async () => {
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockRejectedValue(new Error("db unavailable")),
    });

    const req = new NextRequest(
      "https://devtrack.example/api/badge/streak-shield?user=octocat"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(calculateStreakFromDates).toHaveBeenCalledWith(
      expect.any(Set),
      expect.any(Set),
      "UTC"
    );
  });
});