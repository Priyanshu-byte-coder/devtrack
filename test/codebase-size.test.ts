import { describe, it, expect } from "vitest";
import {
  getCodebaseSize,
  getCodebaseSizeFromLanguages,
} from "../src/lib/codebase-size";

// Thresholds from src/lib/codebase-size.ts:
//   < 51_200 bytes (50 KB)          → "Small"
//   51_200 – 512_000 bytes (500 KB) → "Medium" (both ends inclusive)
//   > 512_000 bytes                 → "Large"
const SMALL_THRESHOLD = 51_200;
const LARGE_THRESHOLD = 512_000;

describe("getCodebaseSize", () => {
  it("classifies a typical small, medium and large codebase", () => {
    expect(getCodebaseSize(10_000)).toBe("Small");
    expect(getCodebaseSize(200_000)).toBe("Medium");
    expect(getCodebaseSize(2_000_000)).toBe("Large");
  });

  it("returns Small for 0 bytes", () => {
    expect(getCodebaseSize(0)).toBe("Small");
  });

  it("returns Small just below the 50 KB threshold", () => {
    expect(getCodebaseSize(SMALL_THRESHOLD - 1)).toBe("Small");
  });

  it("returns Medium exactly at the 50 KB threshold", () => {
    expect(getCodebaseSize(SMALL_THRESHOLD)).toBe("Medium");
  });

  it("returns Medium exactly at the 500 KB threshold", () => {
    expect(getCodebaseSize(LARGE_THRESHOLD)).toBe("Medium");
  });

  it("returns Large just above the 500 KB threshold", () => {
    expect(getCodebaseSize(LARGE_THRESHOLD + 1)).toBe("Large");
  });

  // Characterises current behaviour: the function does not validate input,
  // so a negative total falls into the first branch.
  it("returns Small for a negative byte count", () => {
    expect(getCodebaseSize(-1)).toBe("Small");
  });
});

describe("getCodebaseSizeFromLanguages", () => {
  it("sums bytes across languages and classifies the total", () => {
    const languages = [
      { bytes: 300_000 },
      { bytes: 150_000 },
      { bytes: 50_000 },
    ];
    expect(getCodebaseSizeFromLanguages(languages)).toBe("Medium");
  });

  it("classifies a single language entry", () => {
    expect(getCodebaseSizeFromLanguages([{ bytes: 1_024 }])).toBe("Small");
  });

  it("uses the summed total, not individual entries, for the boundary", () => {
    // Each entry is Small on its own, but together they cross into Medium.
    const languages = [{ bytes: 25_600 }, { bytes: 25_600 }];
    expect(getCodebaseSizeFromLanguages(languages)).toBe("Medium");
  });

  it("returns Large when the summed total exceeds 500 KB", () => {
    const languages = [{ bytes: 256_000 }, { bytes: 256_001 }];
    expect(getCodebaseSizeFromLanguages(languages)).toBe("Large");
  });

  it("returns null when languages is undefined", () => {
    expect(getCodebaseSizeFromLanguages(undefined)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(getCodebaseSizeFromLanguages([])).toBeNull();
  });

  it("returns null when every language reports 0 bytes", () => {
    expect(
      getCodebaseSizeFromLanguages([{ bytes: 0 }, { bytes: 0 }])
    ).toBeNull();
  });

  it("returns null when the summed total is negative", () => {
    expect(
      getCodebaseSizeFromLanguages([{ bytes: 100 }, { bytes: -200 }])
    ).toBeNull();
  });
});
