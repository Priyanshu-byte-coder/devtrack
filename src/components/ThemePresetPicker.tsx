"use client";

import {
  THEME_OPTIONS,
  type ThemeId,
} from "@/lib/themes";

import { useTheme } from "./ThemeContext";

export default function ThemePresetPicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor="theme-select"
        className="text-sm font-medium"
      >
        Theme
      </label>

      <select
        id="theme-select"
        value={theme}
        onChange={(e) =>
          setTheme(e.target.value as ThemeId)
        }
        className="border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {THEME_OPTIONS.map((themeOption) => (
          <option
            key={themeOption.id}
            value={themeOption.id}
          >
            {themeOption.name}
          </option>
        ))}
      </select>
    </div>
  );
}