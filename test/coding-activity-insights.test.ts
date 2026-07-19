import { describe, it, expect } from "vitest";
import {
  formatHourRange,
  formatTimeZoneLabel,
} from "../src/lib/coding-activity-insights";

describe("coding-activity-insights", () => {
  describe("formatHourRange", () => {
    it("formats 0 as 12 AM - 1 AM", () => {
      expect(formatHourRange(0)).toBe("12 AM \u2013 1 AM");
    });

    it("formats 12 as 12 PM - 1 PM", () => {
      expect(formatHourRange(12)).toBe("12 PM \u2013 1 PM");
    });

    it("formats 23 as 11 PM - 12 AM", () => {
      expect(formatHourRange(23)).toBe("11 PM \u2013 12 AM");
    });

    it("formats 6 as 6 AM - 7 AM", () => {
      expect(formatHourRange(6)).toBe("6 AM \u2013 7 AM");
    });

    it("formats 18 as 6 PM - 7 PM", () => {
      expect(formatHourRange(18)).toBe("6 PM \u2013 7 PM");
    });
  });

  describe("formatTimeZoneLabel", () => {
    it("returns UTC offset for valid timezone", () => {
      const result = formatTimeZoneLabel("America/New_York");
      expect(result).toMatch(/UTC/);
    });

    it("returns raw timezone for invalid timezone", () => {
      const result = formatTimeZoneLabel("Invalid/Timezone");
      expect(result).toBe("Invalid/Timezone");
    });

    it("handles UTC timezone", () => {
      const result = formatTimeZoneLabel("UTC");
      expect(result).toMatch(/UTC/);
    });
  });
});