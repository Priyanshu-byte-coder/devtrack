import { describe, it, expect } from "vitest";
import {
  THEME_OPTIONS,
  DEFAULT_THEME,
  isThemeId,
  getThemeDefinition,
  isDarkTheme,
  nextThemeId,
} from "../src/lib/themes";
import type { ThemeId } from "../src/lib/themes";

describe("THEME_OPTIONS", () => {
  it("has 4 theme options", () => {
    expect(THEME_OPTIONS).toHaveLength(4);
  });

  it("includes classic-dark as default", () => {
    expect(THEME_OPTIONS.some((t) => t.id === "classic-dark")).toBe(true);
  });
});

describe("DEFAULT_THEME", () => {
  it("is classic-dark", () => {
    expect(DEFAULT_THEME).toBe("classic-dark");
  });
});

describe("isThemeId", () => {
  it("returns true for valid theme IDs", () => {
    expect(isThemeId("classic-dark")).toBe(true);
    expect(isThemeId("modern-light-blue")).toBe(true);
    expect(isThemeId("nordic-frost")).toBe(true);
    expect(isThemeId("cyberpunk-matrix")).toBe(true);
  });

  it("returns false for invalid theme IDs", () => {
    expect(isThemeId("invalid")).toBe(false);
    expect(isThemeId("")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isThemeId(42 as any)).toBe(false);
  });
});

describe("getThemeDefinition", () => {
  it("returns definition for known theme", () => {
    const def = getThemeDefinition("nordic-frost");
    expect(def.id).toBe("nordic-frost");
    expect(def.mode).toBe("dark");
  });

  it("falls back to classic-dark for unknown ID", () => {
    const def = getThemeDefinition("not-a-theme" as ThemeId);
    expect(def.id).toBe("classic-dark");
  });
});

describe("isDarkTheme", () => {
  it("returns true for dark mode themes", () => {
    expect(isDarkTheme("classic-dark")).toBe(true);
    expect(isDarkTheme("nordic-frost")).toBe(true);
    expect(isDarkTheme("cyberpunk-matrix")).toBe(true);
  });

  it("returns false for light mode themes", () => {
    expect(isDarkTheme("modern-light-blue")).toBe(false);
  });
});

describe("nextThemeId", () => {
  it("cycles through all themes", () => {
    const ids = THEME_OPTIONS.map((t) => t.id);
    for (let i = 0; i < ids.length; i++) {
      const next = nextThemeId(ids[i]);
      expect(ids).toContain(next);
      expect(next).not.toBe(ids[i]);
    }
  });

  it("wraps from last to first", () => {
    const lastId = THEME_OPTIONS[THEME_OPTIONS.length - 1].id;
    const next = nextThemeId(lastId);
    expect(next).toBe(THEME_OPTIONS[0].id);
  });

  it("falls back to first theme for unknown input", () => {
    const next = nextThemeId("unknown-theme" as ThemeId);
    expect(THEME_OPTIONS.some((t) => t.id === next)).toBe(true);
  });
});
