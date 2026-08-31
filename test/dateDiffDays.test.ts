import { describe, it, expect } from "vitest";
import { dateDiffDays } from "../src/lib/date-utils";

describe("dateUtils dateDiffDays", () => {
  it("returns 0 for same day", () => {
    expect(dateDiffDays("2024-06-15", "2024-06-15")).toBe(0);
  });

  it("returns positive for future date", () => {
    expect(dateDiffDays("2024-06-15", "2024-06-20")).toBe(5);
  });

  it("returns negative for past date", () => {
    expect(dateDiffDays("2024-06-20", "2024-06-15")).toBe(-5);
  });

  it("handles leap year Feb 28 to Mar 1", () => {
    expect(dateDiffDays("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("handles year boundary crossing", () => {
    expect(dateDiffDays("2023-12-31", "2024-01-01")).toBe(1);
  });

  it("handles month boundary within year", () => {
    expect(dateDiffDays("2024-01-31", "2024-02-01")).toBe(1);
  });

  it("returns exact day difference for sequential days", () => {
    expect(dateDiffDays("2024-05-01", "2024-05-02")).toBe(1);
    expect(dateDiffDays("2024-05-01", "2024-05-03")).toBe(2);
  });

  it("handles large day differences", () => {
    expect(dateDiffDays("2024-01-01", "2024-12-31")).toBe(365);
  });

  it("returns 1 for consecutive days regardless of month length", () => {
    expect(dateDiffDays("2024-01-30", "2024-01-31")).toBe(1);
    expect(dateDiffDays("2024-02-28", "2024-02-29")).toBe(1);
  });

  it("handles negative day differences spanning years", () => {
    expect(dateDiffDays("2025-01-01", "2024-01-01")).toBe(-366);
  });

  it("returns positive day differences for non-consecutive dates", () => {
    expect(dateDiffDays("2024-04-05", "2024-04-15")).toBe(10);
  });

  it("handles month boundary edge cases", () => {
    expect(dateDiffDays("2024-04-30", "2024-05-01")).toBe(1);
    expect(dateDiffDays("2024-05-31", "2024-06-01")).toBe(1);
  });

  it("handles leap year and non-leap year boundaries", () => {
    expect(dateDiffDays("2024-02-28", "2024-03-01")).toBe(2);
    expect(dateDiffDays("2023-02-28", "2023-03-01")).toBe(1);
  });

  it("returns NaN for invalid date input", () => {
    expect(Number.isNaN(dateDiffDays("invalid-date", "2024-01-01"))).toBe(true);
    expect(Number.isNaN(dateDiffDays("2024-01-01", "not-a-date"))).toBe(true);
  });

  it("returns fractional days when times differ on same date", () => {
    const diff = dateDiffDays("2024-06-15T10:00:00Z", "2024-06-15T23:59:59Z");
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(1);
  });
});