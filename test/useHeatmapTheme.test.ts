import { describe, it, expect } from 'vitest';

import { getHeatmapThemeConfig, getHeatmapCellStyle, getCalendarCellStyle, HeatmapTheme } from '../src/hooks/useHeatmapTheme';

describe('useHeatmapTheme - getHeatmapThemeConfig', () => {
  it('returns default config for "default" theme', () => {
    const config = getHeatmapThemeConfig('default');
    expect(config.accent).toBe('rgba(33, 110, 57, 1)');
    expect(config.levelOne).toBe('rgba(155, 233, 168, 0.85)');
  });

  it('returns colour-blind-friendly config for that theme', () => {
    const config = getHeatmapThemeConfig('colour-blind-friendly');
    expect(config.accent).toBe('rgba(8, 81, 156, 1)');
    expect(config.levelOne).toBe('rgba(207, 232, 255, 0.9)');
  });

  it('falls back to default for unknown theme', () => {
    const config = getHeatmapThemeConfig('unknown' as HeatmapTheme);
    expect(config).toEqual(getHeatmapThemeConfig('default'));
  });
});

describe('useHeatmapTheme - getHeatmapCellStyle', () => {
  it('returns missed style for count === 0', () => {
    const config = getHeatmapThemeConfig('default');
    const style = getHeatmapCellStyle(0, config);
    expect(style.backgroundColor).toBe('rgba(148, 163, 184, 0.15)');
  });

  it('returns levelOne style for 1 <= count < 3', () => {
    const config = getHeatmapThemeConfig('default');
    const style = getHeatmapCellStyle(1, config);
    expect(style.backgroundColor).toBe('rgba(155, 233, 168, 0.85)');
    const style2 = getHeatmapCellStyle(2, config);
    expect(style2.backgroundColor).toBe('rgba(155, 233, 168, 0.85)');
  });

  it('returns levelTwo style for 3 <= count < 6', () => {
    const config = getHeatmapThemeConfig('default');
    const style = getHeatmapCellStyle(3, config);
    expect(style.backgroundColor).toBe('rgba(64, 196, 99, 0.9)');
    const style2 = getHeatmapCellStyle(5, config);
    expect(style2.backgroundColor).toBe('rgba(64, 196, 99, 0.9)');
  });

  it('returns levelThree style for 6 <= count < 10', () => {
    const config = getHeatmapThemeConfig('default');
    const style = getHeatmapCellStyle(6, config);
    expect(style.backgroundColor).toBe('rgba(48, 161, 78, 0.95)');
    const style2 = getHeatmapCellStyle(9, config);
    expect(style2.backgroundColor).toBe('rgba(48, 161, 78, 0.95)');
  });

  it('returns levelFour style for count >= 10', () => {
    const config = getHeatmapThemeConfig('default');
    const style = getHeatmapCellStyle(10, config);
    expect(style.backgroundColor).toBe('rgba(33, 110, 57, 1)');
    const style2 = getHeatmapCellStyle(100, config);
    expect(style2.backgroundColor).toBe('rgba(33, 110, 57, 1)');
  });

  it('all styles include borderColor', () => {
    const config = getHeatmapThemeConfig('default');
    for (let count = 0; count <= 100; count++) {
      const style = getHeatmapCellStyle(count, config);
      expect(style.borderColor).toBeDefined();
    }
  });
});

describe('useHeatmapTheme - getCalendarCellStyle', () => {
  it('returns same level thresholds as getHeatmapCellStyle', () => {
    const config = getHeatmapThemeConfig('default');
    for (let count = 0; count <= 20; count++) {
      const heatmapStyle = getHeatmapCellStyle(count, config);
      const calendarStyle = getCalendarCellStyle(count, config);
      expect(calendarStyle.backgroundColor).toBe(heatmapStyle.backgroundColor);
    }
  });
});
