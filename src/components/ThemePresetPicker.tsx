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
        className="
          rounded-lg
          border
          border-border
          bg-background
          px-3
          py-2
          text-foreground
          focus:outline-none
          focus:ring-2
          focus:ring-accent
        "
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