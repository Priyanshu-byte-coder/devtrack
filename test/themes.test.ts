import { describe, it, expect } from "vitest";
import {
  THEME_OPTIONS,
  DEFAULT_THEME,
  isThemeId,
  getThemeDefinition,
  isDarkTheme,
  nextThemeId,
  type ThemeId,
} from "../src/lib/themes";

describe("isThemeId", () => {
  it("returns true for every valid theme id", () => {
    for (const theme of THEME_OPTIONS) {
      expect(isThemeId(theme.id)).toBe(true);
    }
  });

  it("returns false for an unknown string", () => {
    expect(isThemeId("not-a-real-theme")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isThemeId("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isThemeId(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isThemeId(undefined)).toBe(false);
  });

  it("is case-sensitive (rejects mismatched casing)", () => {
    expect(isThemeId("Classic-Dark")).toBe(false);
  });
});

describe("getThemeDefinition", () => {
  it("returns the matching definition for each valid id", () => {
    for (const theme of THEME_OPTIONS) {
      expect(getThemeDefinition(theme.id)).toEqual(theme);
    }
  });

  it("falls back to the first theme option for an unrecognized id", () => {
    // Cast is required since the function's type signature expects a ThemeId,
    // but we want to verify runtime behavior for unexpected/invalid input.
    const result = getThemeDefinition("bogus-theme" as ThemeId);
    expect(result).toEqual(THEME_OPTIONS[0]);
  });

  it("fallback matches the DEFAULT_THEME id", () => {
    const result = getThemeDefinition("bogus-theme" as ThemeId);
    expect(result.id).toBe(DEFAULT_THEME);
  });
});

describe("isDarkTheme", () => {
  it("returns true for dark-mode themes", () => {
    expect(isDarkTheme("classic-dark")).toBe(true);
    expect(isDarkTheme("nordic-frost")).toBe(true);
    expect(isDarkTheme("cyberpunk-matrix")).toBe(true);
  });

  it("returns false for light-mode themes", () => {
    expect(isDarkTheme("modern-light-blue")).toBe(false);
  });

  it("falls back to the default theme's mode for an unrecognized id", () => {
    const fallbackMode = getThemeDefinition(DEFAULT_THEME).mode;
    const result = isDarkTheme("bogus-theme" as ThemeId);
    expect(result).toBe(fallbackMode === "dark");
  });
});

describe("nextThemeId", () => {
  it("cycles forward through consecutive themes in THEME_OPTIONS order", () => {
    for (let i = 0; i < THEME_OPTIONS.length - 1; i++) {
      const current = THEME_OPTIONS[i].id;
      const expected = THEME_OPTIONS[i + 1].id;
      expect(nextThemeId(current)).toBe(expected);
    }
  });

  it("wraps around from the last theme back to the first", () => {
    const last = THEME_OPTIONS[THEME_OPTIONS.length - 1].id;
    const first = THEME_OPTIONS[0].id;
    expect(nextThemeId(last)).toBe(first);
  });

  it("visits every theme exactly once over a full cycle", () => {
    const visited: ThemeId[] = [];
    let current = THEME_OPTIONS[0].id;
    for (let i = 0; i < THEME_OPTIONS.length; i++) {
      visited.push(current);
      current = nextThemeId(current);
    }
    const uniqueIds = new Set(visited);
    expect(uniqueIds.size).toBe(THEME_OPTIONS.length);
    // After a full cycle we should be back at the start
    expect(current).toBe(THEME_OPTIONS[0].id);
  });

  it("falls back to the first theme's next when given an invalid id", () => {
    // fallbackIndex resolves to 0, so next should be THEME_OPTIONS[1]
    const result = nextThemeId("not-a-real-theme" as ThemeId);
    expect(result).toBe(THEME_OPTIONS[1].id);
  });
});