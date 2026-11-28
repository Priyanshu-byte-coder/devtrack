import { describe, it, expect } from "vitest";
import { LANGUAGE_COLORS, languageColor } from "@/lib/language-colors";

describe("LANGUAGE_COLORS", () => {
  it("contains the expected color for common languages", () => {
    expect(LANGUAGE_COLORS.TypeScript).toBe("#3178c6");
    expect(LANGUAGE_COLORS.JavaScript).toBe("#f7df1e");
    expect(LANGUAGE_COLORS.Python).toBe("#3572A5");
    expect(LANGUAGE_COLORS.Rust).toBe("#dea584");
    expect(LANGUAGE_COLORS.Java).toBe("#b07219");
  });

  it("contains colors for all configured language entries", () => {
    expect(Object.keys(LANGUAGE_COLORS).length).toBeGreaterThan(0);

    for (const color of Object.values(LANGUAGE_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("languageColor", () => {
  it("returns the configured color for a known language", () => {
    expect(languageColor("TypeScript")).toBe("#3178c6");
    expect(languageColor("Go")).toBe("#00ADD8");
  });

  it("returns neutral grey for an unknown language", () => {
    expect(languageColor("UnknownLanguage")).toBe("#8b949e");
  });

  it("returns neutral grey for null", () => {
    expect(languageColor(null)).toBe("#8b949e");
  });

  it("returns neutral grey for undefined", () => {
    expect(languageColor(undefined)).toBe("#8b949e");
  });

  it("returns neutral grey for an empty string", () => {
    expect(languageColor("")).toBe("#8b949e");
  });
});
