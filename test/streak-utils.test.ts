import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateCurrentStreak,
  calculateLongestStreak,
} from "@/lib/streak-utils";

describe("streak-utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateCurrentStreak", () => {
    it("returns 0 for no commits", () => {
      expect(calculateCurrentStreak([])).toBe(0);
    });

    it("returns 1 for a single commit today", () => {
      expect(calculateCurrentStreak(["2026-05-23"])).toBe(1);
    });

    it("returns 1 for a single commit yesterday", () => {
      expect(calculateCurrentStreak(["2026-05-22"])).toBe(1);
    });

    it("returns 0 when the latest commit is older than yesterday", () => {
      expect(calculateCurrentStreak(["2026-05-21"])).toBe(0);
    });

    it("counts the latest consecutive run when it reaches today", () => {
      expect(
        calculateCurrentStreak(["2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23"])
      ).toBe(4);
    });

    it("counts the latest consecutive run when it reaches yesterday", () => {
      expect(
        calculateCurrentStreak(["2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22"])
      ).toBe(4);
    });

    it("resets after a gap before the latest active day", () => {
      expect(
        calculateCurrentStreak(["2026-05-18", "2026-05-19", "2026-05-22", "2026-05-23"])
      ).toBe(2);
    });

    it("deduplicates multiple commits on the same day", () => {
      expect(
        calculateCurrentStreak(["2026-05-22", "2026-05-22", "2026-05-23"])
      ).toBe(2);
    });

    it("handles unsorted input", () => {
      expect(
        calculateCurrentStreak(["2026-05-23", "2026-05-20", "2026-05-22", "2026-05-21"])
      ).toBe(4);
    });

    it("accepts Date inputs", () => {
      expect(
        calculateCurrentStreak([
          new Date("2026-05-21T10:00:00"),
          new Date("2026-05-22T10:00:00"),
          new Date("2026-05-23T10:00:00"),
        ])
      ).toBe(3);
    });
  });

  describe("calculateLongestStreak", () => {
    it("returns 0 for empty input", () => {
      expect(calculateLongestStreak([])).toBe(0);
    });

    it("returns 1 for a single active day", () => {
      expect(calculateLongestStreak(["2026-05-10"])).toBe(1);
    });

    it("finds the all-time longest streak across gaps", () => {
      expect(
        calculateLongestStreak([
          "2026-05-01",
          "2026-05-02",
          "2026-05-03",
          "2026-05-10",
          "2026-05-11",
        ])
      ).toBe(3);
    });

    it("deduplicates dates before calculating the record", () => {
      expect(
        calculateLongestStreak([
          "2026-05-01",
          "2026-05-01",
          "2026-05-02",
          "2026-05-02",
          "2026-05-03",
        ])
      ).toBe(3);
    });

    it("handles unsorted input when calculating the record", () => {
      expect(
        calculateLongestStreak([
          "2026-05-05",
          "2026-05-01",
          "2026-05-03",
          "2026-05-02",
          "2026-05-04",
        ])
      ).toBe(5);
    });
  });
});
