import { describe, it, expect, vi, afterEach } from "vitest";
import {
  toDateStr,
  dateDiffDays,
  getThisWeekRange,
  getLastWeekRange,
} from "../src/lib/date-utils";

// 每个测试后恢复真实时间
afterEach(() => {
  vi.useRealTimers();
});

describe("toDateStr", () => {
  it("should convert a Date to ISO date string (YYYY-MM-DD)", () => {
    const date = new Date(Date.UTC(2024, 2, 15, 12, 30, 0)); // UTC Date
    expect(toDateStr(date)).toBe("2024-03-15");
  });

  it("should handle end-of-year boundary", () => {
    const newYear = new Date(Date.UTC(2023, 11, 31, 23, 59, 59)); // UTC Date
    expect(toDateStr(newYear)).toBe("2023-12-31");
  });

  it("should format single-digit months/days with zero padding", () => {
    const date = new Date(Date.UTC(2024, 0, 9)); // UTC Jan 9
    expect(toDateStr(date)).toBe("2024-01-09");
  });
});

describe("dateDiffDays", () => {
  it("should return correct day difference between two date strings", () => {
    expect(dateDiffDays("2024-01-01", "2024-01-10")).toBe(9);
  });

  it("should handle same-day difference", () => {
    expect(dateDiffDays("2024-06-15", "2024-06-15")).toBe(0);
  });

  it("should handle leap year dates", () => {
    // 2024 is a leap year, so Feb 28 -> Mar 1 = 2 days
    expect(dateDiffDays("2024-02-28", "2024-03-01")).toBe(2);
  });
});

describe("getThisWeekRange", () => {
  it("should return start as Monday 00:00 UTC and end as current day 23:59:59 UTC", () => {
    // Mock "now" to a Wednesday in UTC
    const mockNow = new Date("2024-04-17T10:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const range = getThisWeekRange();

    // Monday of that week (2024-04-15)
    const expectedStart = new Date(Date.UTC(2024, 3, 15, 0, 0, 0, 0)).toISOString();
    // Wednesday end (2024-04-17, 23:59:59.000Z)
    const expectedEnd = new Date(Date.UTC(2024, 3, 17, 23, 59, 59, 0)).toISOString();

    expect(range.start).toBe(expectedStart);
    expect(range.end).toBe(expectedEnd);
  });

  it("should handle Sunday (end equals start when today is Monday)", () => {
    const mockMonday = new Date("2024-04-22T08:00:00Z"); // Monday
    vi.useFakeTimers();
    vi.setSystemTime(mockMonday);

    const range = getThisWeekRange();

    const expectedStart = new Date(Date.UTC(2024, 3, 22, 0, 0, 0, 0)).toISOString();
    const expectedEnd = new Date(Date.UTC(2024, 3, 22, 23, 59, 59, 0)).toISOString();

    expect(range.start).toBe(expectedStart);
    expect(range.end).toBe(expectedEnd);
  });

  it("should handle month/year transition", () => {
    // 2024-01-01 is a Monday
    const mockNewYear = new Date("2024-01-01T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockNewYear);

    const range = getThisWeekRange();

    const expectedStart = new Date(Date.UTC(2024, 0, 1, 0, 0, 0, 0)).toISOString();
    const expectedEnd = new Date(Date.UTC(2024, 0, 1, 23, 59, 59, 0)).toISOString();

    expect(range.start).toBe(expectedStart);
    expect(range.end).toBe(expectedEnd);
  });
});

describe("getLastWeekRange", () => {
  it("should return previous Monday-Sunday range", () => {
    const mockNow = new Date("2024-04-17T10:00:00Z"); // Wednesday
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const range = getLastWeekRange();

    // Previous Monday = 2024-04-08, Sunday = 2024-04-14
    const expectedStart = new Date(Date.UTC(2024, 3, 8, 0, 0, 0, 0)).toISOString();
    const expectedEnd = new Date(Date.UTC(2024, 3, 14, 23, 59, 59, 0)).toISOString();

    expect(range.start).toBe(expectedStart);
    expect(range.end).toBe(expectedEnd);
  });

  it("should handle year transition (first week of January)", () => {
    const mockNewYear = new Date("2024-01-03T10:00:00Z"); // Wednesday
    vi.useFakeTimers();
    vi.setSystemTime(mockNewYear);

    const range = getLastWeekRange();

    // Previous week: Monday 2023-12-25, Sunday 2023-12-31
    const expectedStart = new Date(Date.UTC(2023, 11, 25, 0, 0, 0, 0)).toISOString();
    const expectedEnd = new Date(Date.UTC(2023, 11, 31, 23, 59, 59, 0)).toISOString();

    expect(range.start).toBe(expectedStart);
    expect(range.end).toBe(expectedEnd);
  });

  it("should handle leap year dates (Feb 29)", () => {
    // 2024-03-04 is a Monday
    const mockLeapWeek = new Date("2024-03-04T12:00:00Z"); // Monday
    vi.useFakeTimers();
    vi.setSystemTime(mockLeapWeek);

    const range = getLastWeekRange();

    // Previous week: Monday 2024-02-26, Sunday 2024-03-03 (includes Feb 29)
    const expectedStart = new Date(Date.UTC(2024, 1, 26, 0, 0, 0, 0)).toISOString();
    const expectedEnd = new Date(Date.UTC(2024, 2, 3, 23, 59, 59, 0)).toISOString();

    expect(range.start).toBe(expectedStart);
    expect(range.end).toBe(expectedEnd);
  });
});

describe("getThisWeekRange — additional edge cases", () => {
  it("should return start as Monday at exactly 00:00:00.000Z (UTC midnight)", () => {
    // Sunday 2024-04-21 23:59:59 UTC — still in previous week
    const mockSunday = new Date("2024-04-21T23:59:59Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockSunday);

    const range = getThisWeekRange();

    // Week started on Monday 2024-04-15
    expect(range.start).toBe(new Date(Date.UTC(2024, 3, 15, 0, 0, 0, 0)).toISOString());
  });

  it("should correctly set end to 23:59:59 on the current day (not midnight)", () => {
    const mockFriday = new Date("2024-04-19T14:30:00Z"); // Friday mid-day
    vi.useFakeTimers();
    vi.setSystemTime(mockFriday);

    const range = getThisWeekRange();

    // End should be Friday 23:59:59
    expect(range.end).toBe(new Date(Date.UTC(2024, 3, 19, 23, 59, 59, 0)).toISOString());
  });

  it("should return a valid ISO string for both start and end", () => {
    const mockNow = new Date("2024-06-12T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const range = getThisWeekRange();

    expect(() => new Date(range.start)).not.toThrow();
    expect(() => new Date(range.end)).not.toThrow();
    expect(new Date(range.start).toISOString()).toBe(range.start);
    expect(new Date(range.end).toISOString()).toBe(range.end);
  });

  it("should have start before or equal to end", () => {
    const mockNow = new Date("2024-09-25T18:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const range = getThisWeekRange();

    expect(new Date(range.start).getTime()).toBeLessThanOrEqual(
      new Date(range.end).getTime()
    );
  });

  it("should span month boundary when week crosses two months", () => {
    // 2024-01-29 is a Monday, week spans Jan 29 – current day Feb 1
    const mockFebruaryDay = new Date("2024-02-01T10:00:00Z"); // Thursday
    vi.useFakeTimers();
    vi.setSystemTime(mockFebruaryDay);

    const range = getThisWeekRange();

    // Week started Monday Jan 29
    expect(range.start).toBe(new Date(Date.UTC(2024, 0, 29, 0, 0, 0, 0)).toISOString());
    // Current day is Feb 1 23:59:59
    expect(range.end).toBe(new Date(Date.UTC(2024, 1, 1, 23, 59, 59, 0)).toISOString());
  });
});

describe("getLastWeekRange — additional edge cases", () => {
  it("should have last week end exactly one day before this week start", () => {
    const mockNow = new Date("2024-05-15T10:00:00Z"); // Wednesday
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const thisWeek = getThisWeekRange();
    const lastWeek = getLastWeekRange();

    const thisWeekStartMs = new Date(thisWeek.start).getTime();
    const lastWeekEndMs = new Date(lastWeek.end).getTime();

    // Last week end (Sun 23:59:59) + 1 second = this week start (Mon 00:00:00)
    expect(lastWeekEndMs + 1000).toBe(thisWeekStartMs);
  });

  it("should span exactly 7 days from Monday to Sunday", () => {
    const mockNow = new Date("2024-04-17T10:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const range = getLastWeekRange();

    const startDay = new Date(range.start).getUTCDay(); // 1 = Monday
    const endDay = new Date(range.end).getUTCDay();   // 0 = Sunday

    expect(startDay).toBe(1); // Monday
    expect(endDay).toBe(0);   // Sunday
  });

  it("should handle month boundary — last week spanning two months", () => {
    // 2024-09-02 is a Monday. Last week was Mon Aug 26 – Sun Sep 1
    const mockMonday = new Date("2024-09-02T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockMonday);

    const range = getLastWeekRange();

    expect(range.start).toBe(new Date(Date.UTC(2024, 7, 26, 0, 0, 0, 0)).toISOString());
    expect(range.end).toBe(new Date(Date.UTC(2024, 8, 1, 23, 59, 59, 0)).toISOString());
  });

  it("should return valid ISO strings", () => {
    const mockNow = new Date("2024-11-20T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);

    const range = getLastWeekRange();

    expect(() => new Date(range.start)).not.toThrow();
    expect(() => new Date(range.end)).not.toThrow();
    expect(new Date(range.start).toISOString()).toBe(range.start);
    expect(new Date(range.end).toISOString()).toBe(range.end);
  });
});
