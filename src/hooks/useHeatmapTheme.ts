"use client";

// import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";

export type HeatmapTheme = "default" | "colour-blind-friendly";

export interface HeatmapThemeConfig {
  accent: string;
  secondary: string;
  missed: string;
  border: string;
  text: string;
  levelOne: string;
  levelTwo: string;
  levelThree: string;
  levelFour: string;
}

const STORAGE_KEY = "heatmap-theme";
const getThemeFromCookie = (): HeatmapTheme | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )theme=([^;]+)'));
  return match ? (match[2] as HeatmapTheme) : null;
};


const themeConfigs: Record<HeatmapTheme, HeatmapThemeConfig> = {
  default: {
    accent: "rgba(33, 110, 57, 1)",
    secondary: "rgba(48, 161, 78, 1)",
    missed: "rgba(148, 163, 184, 0.15)",
    border: "rgba(148, 163, 184, 0.35)",
    text: "var(--card-foreground)",
    levelOne: "rgba(155, 233, 168, 0.85)",
    levelTwo: "rgba(64, 196, 99, 0.9)",
    levelThree: "rgba(48, 161, 78, 0.95)",
    levelFour: "rgba(33, 110, 57, 1)",
  },
  "colour-blind-friendly": {
    accent: "rgba(8, 81, 156, 1)",
    secondary: "rgba(33, 113, 181, 1)",
    missed: "rgba(148, 163, 184, 0.15)",
    border: "rgba(148, 163, 184, 0.35)",
    text: "var(--foreground)",
    levelOne: "rgba(207, 232, 255, 0.9)",
    levelTwo: "rgba(107, 174, 214, 0.95)",
    levelThree: "rgba(33, 113, 181, 0.98)",
    levelFour: "rgba(8, 81, 156, 1)",
  },
};

export function getHeatmapThemeConfig(theme: HeatmapTheme): HeatmapThemeConfig {
  return themeConfigs[theme] ?? themeConfigs.default;
}

export function getHeatmapCellStyle(count: number, config: HeatmapThemeConfig): CSSProperties {
  if (count === 0) {
    return {
      backgroundColor: config.missed,
      borderColor: config.border,
    };
  }

  if (count < 3) {
    return {
      backgroundColor: config.levelOne,
      borderColor: config.border,
    };
  }

  if (count < 6) {
    return {
      backgroundColor: config.levelTwo,
      borderColor: config.border,
    };
  }

  if (count < 10) {
    return {
      backgroundColor: config.levelThree,
      borderColor: config.border,
    };
  }

  return {
    backgroundColor: config.levelFour,
    borderColor: config.border,
  };
}

export function getCalendarCellStyle(count: number, config: HeatmapThemeConfig): CSSProperties {
  if (count === 0) {
    return {
      backgroundColor: config.missed,
      borderColor: config.border,
    };
  }

  if (count < 3) {
    return {
      backgroundColor: config.levelOne,
      borderColor: config.border,
    };
  }

  if (count < 6) {
    return {
      backgroundColor: config.levelTwo,
      borderColor: config.border,
    };
  }

  if (count < 10) {
    return {
      backgroundColor: config.levelThree,
      borderColor: config.border,
    };
  }

  return {
    backgroundColor: config.levelFour,
    borderColor: config.border,
  };
}

export function useHeatmapTheme() {
  const [theme, _setTheme] = useState<HeatmapTheme>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(STORAGE_KEY) as HeatmapTheme | null;
    if (saved === "colour-blind-friendly") {
      _setTheme(saved);
      return;
    }

    _setTheme(saved ?? "default");
  }, []);

  const setTheme = (t: HeatmapTheme) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, t);
      } catch (e) {}
      window.dispatchEvent(new CustomEvent("heatmap-theme-changed", { detail: t }));
    }

    _setTheme(t);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY && typeof ev.newValue === "string") {
        _setTheme(ev.newValue as HeatmapTheme);
      }
    };

    const onCustom = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as HeatmapTheme | undefined;
      if (detail) _setTheme(detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("heatmap-theme-changed", onCustom as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("heatmap-theme-changed", onCustom as EventListener);
    };
  }, []);

  const themeConfig = useMemo(() => {
    const activeTheme = mounted ? theme : "default";
    return getHeatmapThemeConfig(activeTheme);
  }, [theme, mounted]);

  const getHeatmapStyle = useCallback(
    (count: number) => getHeatmapCellStyle(count, themeConfig),
    [themeConfig]
  );

  const getCalendarStyle = useCallback(
    (count: number) => getCalendarCellStyle(count, themeConfig),
    [themeConfig]
  );

  return {
    theme: mounted ? theme : "default",
    setTheme,
    themeConfig,
    getHeatmapStyle,
    getCalendarStyle,
  };
}
