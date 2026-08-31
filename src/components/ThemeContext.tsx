"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import {
  DEFAULT_THEME,
  getThemeDefinition,
  isThemeId,
  nextThemeId,
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

const useSafeLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, updateTheme] = useState<ThemeId | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedTheme = localStorage.getItem("theme") || localStorage.getItem(THEME_STORAGE_KEY);
        if (isThemeId(storedTheme)) {
          updateTheme(storedTheme);
          return;
        }

        // Respect prefers-color-scheme on first load
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        updateTheme(systemPrefersDark ? "classic-dark" : "modern-light-blue");
      } catch (e) {
        updateTheme(DEFAULT_THEME);
      }
    }
  }, []);

  useSafeLayoutEffect(() => {
    if (!theme) return;

    const html = document.documentElement;
    const definition = getThemeDefinition(theme);

    html.dataset.theme = theme;
    html.classList.toggle("dark", definition.mode === "dark");
    html.style.colorScheme = definition.mode;
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    updateTheme(nextTheme);
    try {
      localStorage.setItem("theme", nextTheme);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (e) {}
  }, []);

  const toggleTheme = useCallback(() => {
    updateTheme((prev) => {
      const next = nextThemeId(prev ?? DEFAULT_THEME);
      try {
        localStorage.setItem("theme", next);
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (e) {}
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
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
