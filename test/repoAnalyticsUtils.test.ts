import { describe, it, expect } from "vitest";
import { formatDate, formatRelativeDate, formatDisplayDate } from "../src/lib/date-utils";

describe("repoAnalyticsUtils", () => {
  describe("formatDate", () => {
    it("should format valid ISO string correctly", () => {
      const formatted = formatDate("2026-05-15T12:00:00.000Z");
      expect(formatted).toContain("May");
      expect(formatted).toContain("15");
      expect(formatted).toContain("2026");
    });

    it("should format UTC date correctly", () => {
      const formatted = formatDate("2026-01-01T00:00:00.000Z");
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("1");
      expect(formatted).toContain("2026");
    });

    it("should format date with timezone offset", () => {
      const formatted = formatDate("2026-03-20T12:30:00.000+05:30");
      expect(formatted).toContain("Mar");
      expect(formatted).toContain("20");
    });
  });

  describe("formatRelativeDate", () => {
    it("should return 'Today' for current date", () => {
      const todayIso = new Date().toISOString();
      expect(formatRelativeDate(todayIso)).toBe("Today");
    });

    it("should return 'Yesterday' for a date 1 day ago", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000);
      expect(formatRelativeDate(yesterday.toISOString())).toBe("Yesterday");
    });

    it("should return 'X days ago' for a date less than 30 days ago", () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - 1000);
      expect(formatRelativeDate(fiveDaysAgo.toISOString())).toBe("5 days ago");
    });

    it("should return absolute formatted date for dates more than 30 days ago", () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const formatted = formatRelativeDate(fortyDaysAgo.toISOString());
      expect(formatted).not.toContain("days ago");
    });

    it("should return '29 days ago' for exactly 29 days ago", () => {
      const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
      expect(formatRelativeDate(twentyNineDaysAgo.toISOString())).toBe("29 days ago");
    });

    it("should return absolute date for exactly 30 days ago", () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const formatted = formatRelativeDate(thirtyDaysAgo.toISOString());
      expect(formatted).not.toContain("days ago");
    });

    it("should return '2 days ago' for 2 days ago", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatRelativeDate(twoDaysAgo.toISOString())).toBe("2 days ago");
    });

    it("should handle future dates", () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const formatted = formatRelativeDate(futureDate.toISOString());
      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe("formatDisplayDate", () => {
    it("should convert Date object to standard local date string", () => {
      const date = new Date("2026-05-15T12:00:00.000Z");
      expect(formatDisplayDate(date)).toBe(date.toLocaleDateString());
    });

    it("should convert ISO string to local date string", () => {
      const dateStr = "2026-05-15T12:00:00.000Z";
      const result = formatDisplayDate(dateStr);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle date only string", () => {
      const result = formatDisplayDate("2026-01-01");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle timezone offset correctly", () => {
      const result = formatDisplayDate("2026-06-15T12:00:00.000+05:30");
      expect(typeof result).toBe("string");
    });
  });
});