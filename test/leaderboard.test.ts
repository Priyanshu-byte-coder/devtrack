import { describe, it, expect, afterEach } from "vitest";
import {
  CACHE_REFRESH_SECONDS,
  CACHE_STALE_SECONDS,
  LEADERBOARD_CACHE_KEY,
  LEADERBOARD_BUILD_LOCK_KEY,
  type LeaderboardMetric,
  type LeaderboardTimeframe,
  type LeaderboardPeriod,
} from "@/lib/leaderboard";

const originalEnv = process.env.LEADERBOARD_USER_CONCURRENCY;

afterEach(() => {
  process.env.LEADERBOARD_USER_CONCURRENCY = originalEnv;
});

describe("exported constants", () => {
  it("CACHE_REFRESH_SECONDS equals 3600", () => {
    expect(CACHE_REFRESH_SECONDS).toBe(3600);
  });

  it("CACHE_STALE_SECONDS equals 21600 (6 hours)", () => {
    expect(CACHE_STALE_SECONDS).toBe(21600);
  });

  it("LEADERBOARD_CACHE_KEY is non-empty string", () => {
    expect(typeof LEADERBOARD_CACHE_KEY).toBe("string");
    expect(LEADERBOARD_CACHE_KEY.length).toBeGreaterThan(0);
  });

  it("LEADERBOARD_BUILD_LOCK_KEY is non-empty string", () => {
    expect(typeof LEADERBOARD_BUILD_LOCK_KEY).toBe("string");
    expect(LEADERBOARD_BUILD_LOCK_KEY.length).toBeGreaterThan(0);
  });

  it("LEADERBOARD_CACHE_KEY differs from BUILD_LOCK_KEY", () => {
    expect(LEADERBOARD_CACHE_KEY).not.toBe(LEADERBOARD_BUILD_LOCK_KEY);
  });
});

describe("exported types", () => {
  it("LeaderboardMetric includes streak, commits, prs", () => {
    const metrics: LeaderboardMetric[] = ["streak", "commits", "prs"];
    expect(metrics).toContain("streak");
    expect(metrics).toContain("commits");
    expect(metrics).toContain("prs");
  });

  it("LeaderboardTimeframe includes weekly, monthly, all_time", () => {
    const timeframes: LeaderboardTimeframe[] = ["weekly", "monthly", "all_time"];
    expect(timeframes).toContain("weekly");
    expect(timeframes).toContain("monthly");
    expect(timeframes).toContain("all_time");
  });

  it("LeaderboardPeriod includes week, month, all", () => {
    const periods: LeaderboardPeriod[] = ["week", "month", "all"];
    expect(periods).toContain("week");
    expect(periods).toContain("month");
    expect(periods).toContain("all");
  });
});
