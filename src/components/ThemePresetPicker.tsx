"use client";

import { THEME_OPTIONS } from "@/lib/themes";
import { useTheme } from "./ThemeContext";
import { ThemeSwatch } from "./ThemeToggle";

/** Theme cards for Settings: each shows its colours so you can pick by eye. */
export default function ThemePresetPicker() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">Theme</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEME_OPTIONS.map((option) => {
          const active = option.id === theme;
          return (
            <label
              key={option.id}
              className={`px-frame flex cursor-pointer items-center gap-3 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)] ${
                active
                  ? "bg-[var(--accent-soft)] px-frame-accent"
                  : "bg-[var(--card)] hover:bg-[var(--control)]"
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={option.id}
                checked={active}
                onChange={() => setTheme(option.id)}
                className="sr-only"
              />
              <ThemeSwatch theme={option} />
              <span className="min-w-0 flex-1">
                <span className="block font-pixel text-xs uppercase tracking-[0.06em] text-[var(--card-foreground)]">
                  {option.name}
                </span>
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {option.description}
                </span>
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className="font-pixel text-xs text-[var(--accent)]"
                >
                  ▶
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
