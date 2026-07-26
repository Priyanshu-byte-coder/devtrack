// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  calculateNextTier,
  calculatePercentage,
} from "../src/lib/achievement-estimators";

describe("calculateNextTier", () => {
  const tiers = [1, 16, 128, 1024];

  it("returns the first tier when current is below all tiers", () => {
    expect(calculateNextTier(0, tiers)).toBe(1);
  });

  it("returns the next tier when current is below a tier", () => {
    expect(calculateNextTier(5, tiers)).toBe(16);
    expect(calculateNextTier(15, tiers)).toBe(16); // 15 < 16, so next is 16
  });

  it("returns the next tier when current equals a tier", () => {
    expect(calculateNextTier(1, tiers)).toBe(16);
    expect(calculateNextTier(16, tiers)).toBe(128);
    expect(calculateNextTier(128, tiers)).toBe(1024);
  });

  it("returns null when current is above all tiers (maxed out)", () => {
    expect(calculateNextTier(1024, tiers)).toBe(null);
    expect(calculateNextTier(5000, tiers)).toBe(null);
  });

  it("returns null for empty tiers array", () => {
    expect(calculateNextTier(10, [])).toBe(null);
  });

  it("returns first tier when current is negative", () => {
    expect(calculateNextTier(-5, tiers)).toBe(1);
  });
});

describe("calculatePercentage", () => {
  it("returns 100 when nextTier is null (maxed out)", () => {
    expect(calculatePercentage(100, null)).toBe(100);
  });

  it("returns 100 when current exceeds nextTier", () => {
    expect(calculatePercentage(200, 100)).toBe(100);
  });

  it("returns floor of the ratio when current is below nextTier", () => {
    expect(calculatePercentage(50, 100)).toBe(50);
    expect(calculatePercentage(1, 3)).toBe(33);
    expect(calculatePercentage(1, 4)).toBe(25);
  });

  it("returns 100 when current equals nextTier", () => {
    expect(calculatePercentage(100, 100)).toBe(100);
  });

  it("handles 0 current gracefully", () => {
    expect(calculatePercentage(0, 100)).toBe(0);
  });
});