import { describe, it, expect } from "vitest";
import { metricCount, metricWithUnit } from "../src/lib/format-metric";

describe("metricWithUnit", () => {
  it("formats finite numbers with a unit", () => {
    expect(metricWithUnit(12.345, "h")).toBe("12.3h");
    expect(metricWithUnit("98", "%")).toBe("98%");
  });

  it("shows a dash instead of undefined/NaN", () => {
    expect(metricWithUnit(undefined, "h")).toBe("—");
    expect(metricWithUnit(Number.NaN, "d")).toBe("—");
    expect(metricWithUnit(null, "%")).toBe("—");
  });
});

describe("metricCount", () => {
  it("passes numbers through and dashes the rest", () => {
    expect(metricCount(4)).toBe(4);
    expect(metricCount(undefined)).toBe("—");
  });
});
