import { describe, it, expect } from "vitest";

import { summarizeCodingActivity } from "./coding-activity-insights";

describe("summarizeCodingActivity", () => {
  it("returns empty activity summary when timestamps array is empty", () => {
    const result = summarizeCodingActivity([], "UTC");

    expect(result.totalActivities).toBe(0);
    expect(result.productivityLevel).toBe("Low");
    expect(result.consistencyScore).toBe(0);
    expect(result.averageDailyCommits).toBe(0);
  });

  it("counts valid timestamps correctly", () => {
    const timestamps = [
      "2026-05-24T10:00:00Z",
      "2026-05-24T11:00:00Z",
      "2026-05-25T12:00:00Z",
    ];

    const result = summarizeCodingActivity(timestamps, "UTC");

    expect(result.totalActivities).toBe(3);
  });

  it("ignores invalid timestamps", () => {
    const timestamps = [
      "invalid-date",
      "2026-05-24T10:00:00Z",
    ];

    const result = summarizeCodingActivity(timestamps, "UTC");

    expect(result.totalActivities).toBe(1);
  });

  it("calculates productivity level correctly", () => {
    const timestamps = [
      "2026-05-18T10:00:00Z",
      "2026-05-19T10:00:00Z",
      "2026-05-20T10:00:00Z",
      "2026-05-21T10:00:00Z",
      "2026-05-22T10:00:00Z",
      "2026-05-23T10:00:00Z",
      "2026-05-24T10:00:00Z",
    ];

    const result = summarizeCodingActivity(timestamps, "UTC");

    expect(result.consistencyScore).toBe(100);
    expect(result.productivityLevel).toBe("Excellent");
  });

  it("detects most active hour correctly", () => {
    const timestamps = [
      "2026-05-24T10:00:00Z",
      "2026-05-24T10:30:00Z",
      "2026-05-24T15:00:00Z",
    ];

    const result = summarizeCodingActivity(timestamps, "UTC");

    expect(result.mostActiveHour.hour).toBe(10);
    expect(result.mostActiveHour.count).toBe(2);
  });
});