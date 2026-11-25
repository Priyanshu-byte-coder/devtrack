"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_THEME,
  getThemeDefinition,
  LIGHT_THEME,
  nextThemeId,
  resolveThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

interface ThemeContextType {
  theme: ThemeId | undefined;
  themeMode: "light" | "dark" | undefined;
  themeDefinition: ReturnType<typeof getThemeDefinition> | undefined;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const useSafeLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, updateTheme] = useState<ThemeId | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      const stored = resolveThemeId(raw);
      if (stored) {
        // Save the migrated id so legacy values only need resolving once.
        if (stored !== raw) localStorage.setItem(THEME_STORAGE_KEY, stored);
        updateTheme(stored);
        return;
      }
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      updateTheme(systemPrefersDark ? DEFAULT_THEME : LIGHT_THEME);
    } catch {
      updateTheme(DEFAULT_THEME);
    }
  }, []);

  const applied = useRef<ThemeId | undefined>(undefined);

  useSafeLayoutEffect(() => {
    if (!theme) return;

    const html = document.documentElement;
    const definition = getThemeDefinition(theme);
    const apply = () => {
      html.dataset.theme = theme;
      html.classList.toggle("dark", definition.mode === "dark");
      html.style.colorScheme = definition.mode;
    };

    // The first apply only syncs what the inline script in layout.tsx set.
    // On a real switch, pause transitions for a frame: otherwise every
    // element with transition-colors fades its text while backgrounds snap,
    // and headings vanish (light text on a light card) for ~300 ms.
    if (applied.current === undefined || applied.current === theme) {
      apply();
    } else {
      const pause = document.createElement("style");
      pause.textContent = "*,*::before,*::after{transition:none!important}";
      document.head.appendChild(pause);
      apply();
      void getComputedStyle(html).color;
      requestAnimationFrame(() => requestAnimationFrame(() => pause.remove()));
    }
    applied.current = theme;
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    updateTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    updateTheme((prev) => {
      const next = nextThemeId(prev ?? DEFAULT_THEME);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const themeDefinition = theme ? getThemeDefinition(theme) : undefined;
  const value: ThemeContextType = {
    theme,
    themeMode: themeDefinition?.mode,
    themeDefinition,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
