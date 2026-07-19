import { describe, it, expect } from "vitest";
import { safeCompare } from "../src/app/api/webhooks/github/safe-compare";

describe("safeCompare", () => {
  it("returns true for equal strings", () => {
    expect(safeCompare("hello", "hello")).toBe(true);
  });

  it("returns true for equal empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
  });

  it("returns false for strings of different length", () => {
    expect(safeCompare("short", "much longer string")).toBe(false);
  });

  it("returns false for equal-length but non-equal strings", () => {
    expect(safeCompare("hello", "world")).toBe(false);
  });

  it("returns false for same length 0 vs different character", () => {
    expect(safeCompare("a", "b")).toBe(false);
  });

  it("handles strings with special characters", () => {
    expect(safeCompare("a=b&c", "a=b&c")).toBe(true);
  });

  it("returns false when one string is a prefix of another", () => {
    expect(safeCompare("hello", "hello!")).toBe(false);
  });
});