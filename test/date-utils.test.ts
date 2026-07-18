import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatRelativeDate,
  formatDisplayDate,
  toDateStr,
  daysBetween,
  dateDiffDays,
  dateDiff,
  isToday,
  isYesterday,
  getThisWeekRange,
  getLastWeekRange,
  getLocalDateString,
  utcToLocalDate,
  areConsecutiveDays,
  calculateStreak,
} from "../src/lib/date-utils";

describe("formatDate", () => {
  it("formats a Date object", () => {
    const d = new Date("2026-05-15T12:00:00Z");
    expect(formatDate(d)).toMatch(/May 15, 2026/);
  });

  it("formats a string", () => {
    expect(formatDate("2026-01-01")).toMatch(/Jan 1, 2026/);
  });

  it("formats a unix timestamp", () => {
    expect(formatDate(1747699200000)).toMatch(/May 20, 2025/);
  });

  it("throws on invalid input", () => {
    expect(() => formatDate("not-a-date")).toThrow("Invalid date");
  });
});

describe("formatRelativeDate", () => {
  it("returns Today for today", () => {
    expect(formatRelativeDate(new Date())).toBe("Today");
  });

  it("returns Yesterday for yesterday", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(formatRelativeDate(d)).toBe("Yesterday");
  });

  it("returns days ago for <30 days", () => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    expect(formatRelativeDate(d)).toBe("5 days ago");
  });

  it("returns formatted date for 30+ days ago", () => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    expect(formatRelativeDate(d)).toMatch(/[A-Z][a-z]+ \d+, \d{4}/);
  });

  it("throws on invalid input", () => {
    expect(() => formatRelativeDate("invalid")).toThrow("Invalid date");
  });
});

describe("toDateStr", () => {
  it("returns YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2026, 4, 15));
    expect(toDateStr(d)).toBe("2026-05-15");
  });

  it("pads month and day", () => {
    const d = new Date(Date.UTC(2026, 0, 5));
    expect(toDateStr(d)).toBe("2026-01-05");
  });
});

describe("daysBetween", () => {
  it("returns positive difference when a < b", () => {
    expect(daysBetween("2026-01-01", "2026-01-10")).toBe(9);
  });

  it("returns negative difference when a > b", () => {
    expect(daysBetween("2026-01-10", "2026-01-01")).toBe(-9);
  });

  it("returns 0 for same day", () => {
    expect(daysBetween("2026-06-15", "2026-06-15")).toBe(0);
  });

  it("throws on invalid input", () => {
    expect(() => daysBetween("invalid", "2026-01-01")).toThrow("Invalid date");
    expect(() => daysBetween("2026-01-01", "invalid")).toThrow("Invalid date");
  });
});

describe("dateDiffDays", () => {
  it("returns fractional days", () => {
    const a = "2026-06-01T00:00:00Z";
    const b = "2026-06-01T12:00:00Z";
    expect(dateDiffDays(a, b)).toBe(0.5);
  });
});

describe("dateDiff alias", () => {
  it("is the same as dateDiffDays", () => {
    expect(dateDiff("2026-06-01", "2026-06-03")).toBe(2);
  });
});

describe("isToday", () => {
  it("returns true for today", () => {
    expect(isToday(new Date())).toBe(true);
  });

  it("returns false for yesterday", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(isToday(d)).toBe(false);
  });

  it("returns false for invalid date", () => {
    expect(isToday("invalid")).toBe(false);
  });
});

describe("isYesterday", () => {
  it("returns true for yesterday", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(isYesterday(d)).toBe(true);
  });

  it("returns false for today", () => {
    expect(isYesterday(new Date())).toBe(false);
  });

  it("returns false for invalid date", () => {
    expect(isYesterday("invalid")).toBe(false);
  });
});

describe("getThisWeekRange", () => {
  it("returns start and end with ISO strings", () => {
    const result = getThisWeekRange();
    expect(typeof result.start).toBe("string");
    expect(typeof result.end).toBe("string");
    expect(new Date(result.start) < new Date(result.end)).toBe(true);
  });
});

describe("getLastWeekRange", () => {
  it("returns start and end with ISO strings", () => {
    const result = getLastWeekRange();
    expect(typeof result.start).toBe("string");
    expect(typeof result.end).toBe("string");
    expect(new Date(result.start) < new Date(result.end)).toBe(true);
  });

  it("end is before this week's start", () => {
    const last = getLastWeekRange();
    const current = getThisWeekRange();
    expect(new Date(last.end) < new Date(current.start)).toBe(true);
  });
});

describe("getLocalDateString", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(getLocalDateString("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns UTC date for UTC timezone", () => {
    const result = getLocalDateString("UTC");
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toBe(today);
  });
});

describe("utcToLocalDate", () => {
  it("converts UTC timestamp to YYYY-MM-DD", () => {
    const result = utcToLocalDate("2026-06-15T12:00:00Z", "UTC");
    expect(result).toBe("2026-06-15");
  });

  it("handles string input", () => {
    const result = utcToLocalDate("2026-06-15T12:00:00Z");
    expect(result).toBeDefined();
  });

  it("handles Date input", () => {
    const result = utcToLocalDate(new Date("2026-06-15T12:00:00Z"));
    expect(result).toBeDefined();
  });
});

describe("areConsecutiveDays", () => {
  it("returns true for consecutive days", () => {
    expect(areConsecutiveDays("2026-06-01", "2026-06-02")).toBe(true);
  });

  it("returns true regardless of timezone param", () => {
    expect(areConsecutiveDays("2026-06-01", "2026-06-02", "America/New_York")).toBe(true);
  });

  it("returns false for same day", () => {
    expect(areConsecutiveDays("2026-06-01", "2026-06-01")).toBe(false);
  });

  it("returns false for non-consecutive days", () => {
    expect(areConsecutiveDays("2026-06-01", "2026-06-05")).toBe(false);
  });
});

describe("calculateStreak", () => {
  it("returns 0 for empty array", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("returns 0 for null/undefined", () => {
    expect(calculateStreak(null as any)).toBe(0);
  });

  it("returns 1 for a single date matching today or yesterday", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(calculateStreak([today])).toBe(1);
  });

  it("returns 0 for a date not matching today or yesterday", () => {
    expect(calculateStreak(["2020-01-01"])).toBe(0);
  });

  it("counts consecutive days", () => {
    const today = new Date();
    const d1 = today.toISOString().slice(0, 10);
    const d2 = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
    const d3 = new Date(today.getTime() - 172800000).toISOString().slice(0, 10);
    expect(calculateStreak([d1, d2, d3])).toBe(3);
  });

  it("breaks streak on gap", () => {
    const today = new Date();
    const d1 = today.toISOString().slice(0, 10);
    const d2 = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
    const d3 = new Date(today.getTime() - 345600000).toISOString().slice(0, 10);
    expect(calculateStreak([d1, d2, d3])).toBe(2);
  });
});
