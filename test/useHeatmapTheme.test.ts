import { describe, it, expect } from "vitest";

import {
  getHeatmapThemeConfig,
  getHeatmapCellStyle,
  getCalendarCellStyle,
  HeatmapTheme,
} from "../src/hooks/useHeatmapTheme";

describe("useHeatmapTheme - getHeatmapThemeConfig", () => {
  it('returns default config for "default" theme', () => {
    const config = getHeatmapThemeConfig("default");
    expect(config.accent).toBe("rgba(33, 110, 57, 1)");
    expect(config.levelOne).toBe("rgba(155, 233, 168, 0.85)");
  });

  it("returns colour-blind-friendly config for that theme", () => {
    const config = getHeatmapThemeConfig("colour-blind-friendly");
    expect(config.accent).toBe("rgba(8, 81, 156, 1)");
    expect(config.levelOne).toBe("rgba(207, 232, 255, 0.9)");
  });

  it('returns theme config for "theme" palette', () => {
    const config = getHeatmapThemeConfig("theme");
    expect(config.accent).toBe("var(--accent)");
    expect(config.missed).toBe("var(--card-muted)");
    expect(config.border).toBe("var(--border)");
    expect(config.levelOne).toBe(
      "color-mix(in srgb, var(--accent) 25%, var(--card))"
    );
    expect(config.levelTwo).toBe(
      "color-mix(in srgb, var(--accent) 50%, var(--card))"
    );
    expect(config.levelThree).toBe(
      "color-mix(in srgb, var(--accent) 75%, var(--card))"
    );
    expect(config.levelFour).toBe(
      "color-mix(in srgb, var(--accent) 100%, var(--card))"
    );
  });

  it("uses var(--card-muted) and var(--border) across all palettes", () => {
    const themes: HeatmapTheme[] = [
      "default",
      "colour-blind-friendly",
      "theme",
    ];
    themes.forEach((t) => {
      const config = getHeatmapThemeConfig(t);
      expect(config.missed).toBe("var(--card-muted)");
      expect(config.border).toBe("var(--border)");
    });
  });

  it("falls back to default for unknown theme", () => {
    const config = getHeatmapThemeConfig("unknown" as HeatmapTheme);
    expect(config).toEqual(getHeatmapThemeConfig("default"));
  });
});

describe("useHeatmapTheme - getHeatmapCellStyle", () => {
  it("returns missed style for count === 0", () => {
    const config = getHeatmapThemeConfig("default");
    const style = getHeatmapCellStyle(0, config);
    expect(style.backgroundColor).toBe("var(--card-muted)");
    expect(style.borderColor).toBe("var(--border)");
  });

  it("returns levelOne style for 1 <= count < 3", () => {
    const config = getHeatmapThemeConfig("default");
    const style = getHeatmapCellStyle(1, config);
    expect(style.backgroundColor).toBe("rgba(155, 233, 168, 0.85)");
    const style2 = getHeatmapCellStyle(2, config);
    expect(style2.backgroundColor).toBe("rgba(155, 233, 168, 0.85)");
  });

  it("returns levelTwo style for 3 <= count < 6", () => {
    const config = getHeatmapThemeConfig("default");
    const style = getHeatmapCellStyle(3, config);
    expect(style.backgroundColor).toBe("rgba(64, 196, 99, 0.9)");
    const style2 = getHeatmapCellStyle(5, config);
    expect(style2.backgroundColor).toBe("rgba(64, 196, 99, 0.9)");
  });

  it("returns levelThree style for 6 <= count < 10", () => {
    const config = getHeatmapThemeConfig("default");
    const style = getHeatmapCellStyle(6, config);
    expect(style.backgroundColor).toBe("rgba(48, 161, 78, 0.95)");
    const style2 = getHeatmapCellStyle(9, config);
    expect(style2.backgroundColor).toBe("rgba(48, 161, 78, 0.95)");
  });

  it("returns levelFour style for count >= 10", () => {
    const config = getHeatmapThemeConfig("default");
    const style = getHeatmapCellStyle(10, config);
    expect(style.backgroundColor).toBe("rgba(33, 110, 57, 1)");
    const style2 = getHeatmapCellStyle(100, config);
    expect(style2.backgroundColor).toBe("rgba(33, 110, 57, 1)");
  });

  it("all styles include borderColor", () => {
    const config = getHeatmapThemeConfig("default");
    for (let count = 0; count <= 100; count++) {
      const style = getHeatmapCellStyle(count, config);
      expect(style.borderColor).toBeDefined();
    }
  });
});

describe("useHeatmapTheme - getCalendarCellStyle", () => {
  it("returns same level thresholds as getHeatmapCellStyle", () => {
    const config = getHeatmapThemeConfig("default");
    for (let count = 0; count <= 20; count++) {
      const heatmapStyle = getHeatmapCellStyle(count, config);
      const calendarStyle = getCalendarCellStyle(count, config);
      expect(calendarStyle.backgroundColor).toBe(heatmapStyle.backgroundColor);
    }
  });
});
