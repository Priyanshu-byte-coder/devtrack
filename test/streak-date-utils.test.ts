import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getLocalDateString,
  utcToLocalDate,
  areConsecutiveDays,
  calculateStreak,
} from "../src/lib/date-utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("getLocalDateString", () => {
  it("returns a YYYY-MM-DD string in UTC by default", () => {
    const result = getLocalDateString("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a YYYY-MM-DD string in a fixed-offset timezone", () => {
    const result = getLocalDateString("Asia/Kolkata");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back to a YYYY-MM-DD string for an invalid timezone", () => {
    const result = getLocalDateString("Not/A_Real_Zone");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("utcToLocalDate", () => {
  it("converts a UTC ISO string to the date in the given timezone", () => {
    // 2026-05-22T20:00:00Z is 2026-05-23T01:30 in Asia/Kolkata (UTC+5:30).
    expect(utcToLocalDate("2026-05-22T20:00:00Z", "Asia/Kolkata")).toBe(
      "2026-05-23"
    );
  });

  it("converts a UTC ISO string to the date in UTC by default", () => {
    expect(utcToLocalDate("2026-05-22T20:00:00Z", "UTC")).toBe("2026-05-22");
  });

  it("accepts a Date object as well as a string", () => {
    expect(utcToLocalDate(new Date("2026-05-22T20:00:00Z"), "UTC")).toBe(
      "2026-05-22"
    );
  });

  it("falls back to the ISO date when the timezone is invalid", () => {
    expect(utcToLocalDate("2026-05-22T20:00:00Z", "Not/A_Real_Zone")).toBe(
      "2026-05-22"
    );
  });
});

describe("areConsecutiveDays", () => {
  it("returns true for adjacent calendar dates", () => {
    expect(areConsecutiveDays("2026-05-22", "2026-05-23")).toBe(true);
    expect(areConsecutiveDays("2026-05-23", "2026-05-22")).toBe(true);
  });

  it("returns true across month and year boundaries", () => {
    expect(areConsecutiveDays("2026-01-31", "2026-02-01")).toBe(true);
    expect(areConsecutiveDays("2025-12-31", "2026-01-01")).toBe(true);
  });

  it("returns false for non-adjacent dates", () => {
    expect(areConsecutiveDays("2026-05-22", "2026-05-24")).toBe(false);
  });

  it("returns false for the same date", () => {
    expect(areConsecutiveDays("2026-05-22", "2026-05-22")).toBe(false);
  });
});

describe("calculateStreak", () => {
  it("returns 0 for an empty input", () => {
    expect(calculateStreak([], "UTC")).toBe(0);
  });

  it("returns 1 for a single date equal to today", () => {
    const today = getLocalDateString("UTC");
    expect(calculateStreak([today], "UTC")).toBe(1);
  });

  it("returns 1 for a single date equal to yesterday (regression: grace period)", () => {
    const today = getLocalDateString("UTC");
    const [y, m, d] = today.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d));
    prev.setUTCDate(prev.getUTCDate() - 1);
    const yesterday = `${prev.getUTCFullYear()}-${String(
      prev.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;

    expect(calculateStreak([yesterday], "UTC")).toBe(1);
  });

  it("returns 0 for a single date older than yesterday", () => {
    expect(calculateStreak(["2020-01-01"], "UTC")).toBe(0);
  });

  it("counts a sorted-most-recent-first array of consecutive dates ending today", () => {
    const today = getLocalDateString("UTC");
    const [y, m, d] = today.split("-").map(Number);
    const dates: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - i);
      dates.push(
        `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
          2,
          "0"
        )}-${String(dt.getUTCDate()).padStart(2, "0")}`
      );
    }

    expect(calculateStreak(dates, "UTC")).toBe(5);
  });

  it("breaks the streak at a one-day gap in the middle", () => {
    const today = getLocalDateString("UTC");
    const [y, m, d] = today.split("-").map(Number);

    const fmt = (date: Date) =>
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getUTCDate()).padStart(2, "0")}`;

    const t = new Date(Date.UTC(y, m - 1, d));
    const t1 = new Date(Date.UTC(y, m - 1, d));
    t1.setUTCDate(t1.getUTCDate() - 1);
    const t3 = new Date(Date.UTC(y, m - 1, d));
    t3.setUTCDate(t3.getUTCDate() - 3);
    const t4 = new Date(Date.UTC(y, m - 1, d));
    t4.setUTCDate(t4.getUTCDate() - 4);

    expect(calculateStreak([fmt(t), fmt(t1), fmt(t3), fmt(t4)], "UTC")).toBe(2);
  });

  it("de-duplicates repeated dates", () => {
    const today = getLocalDateString("UTC");
    expect(calculateStreak([today, today, today], "UTC")).toBe(1);
  });

  it("ignores the order of input dates (sorts internally)", () => {
    const today = getLocalDateString("UTC");
    const [y, m, d] = today.split("-").map(Number);
    const t1 = new Date(Date.UTC(y, m - 1, d));
    t1.setUTCDate(t1.getUTCDate() - 1);
    const yesterday = `${t1.getUTCFullYear()}-${String(
      t1.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(t1.getUTCDate()).padStart(2, "0")}`;

    expect(calculateStreak([yesterday, today], "UTC")).toBe(2);
    expect(calculateStreak([today, yesterday], "UTC")).toBe(2);
  });
});
