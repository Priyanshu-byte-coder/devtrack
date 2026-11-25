export type ThemeId = "arcade" | "daylight" | "terminal" | "synthwave";

export type ThemeMode = "light" | "dark";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  mode: ThemeMode;
  /** Background, accent and second accent, for the picker swatches. */
  swatch: [string, string, string];
};

export const THEME_STORAGE_KEY = "theme";

export const THEME_OPTIONS: ThemeDefinition[] = [
  {
    id: "arcade",
    name: "Arcade",
    description: "Navy night, blue neon",
    mode: "dark",
    swatch: ["#050816", "#6ba8ff", "#f2c14e"],
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "Light and crisp",
    mode: "light",
    swatch: ["#f6f8fc", "#2563eb", "#0f172a"],
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Green phosphor CRT",
    mode: "dark",
    swatch: ["#020a04", "#39ff6a", "#ffb000"],
  },
  {
    id: "synthwave",
    name: "Synthwave",
    description: "Purple night, pink and cyan",
    mode: "dark",
    swatch: ["#12052b", "#ff4fd8", "#29e0ff"],
  },
];

export const DEFAULT_THEME: ThemeId = "arcade";
export const LIGHT_THEME: ThemeId = "daylight";

/**
 * Theme ids saved before the 2026-11 theme rework, mapped to the closest new
 * theme so returning players keep a similar look.
 */
export const LEGACY_THEME_IDS: Record<string, ThemeId> = {
  "classic-dark": "arcade",
  "nordic-frost": "arcade",
  "modern-light-blue": "daylight",
  "cyberpunk-matrix": "terminal",
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value) && THEME_OPTIONS.some((theme) => theme.id === value);
}

/** A saved value as a current theme id, or null when it isn't one. */
export function resolveThemeId(
  value: string | null | undefined
): ThemeId | null {
  if (isThemeId(value)) return value;
  return (value && LEGACY_THEME_IDS[value]) || null;
}

export function getThemeDefinition(themeId: ThemeId) {
  return (
    THEME_OPTIONS.find((theme) => theme.id === themeId) ?? THEME_OPTIONS[0]
  );
}

export function isDarkTheme(themeId: ThemeId) {
  return getThemeDefinition(themeId).mode === "dark";
}

export function nextThemeId(currentTheme: ThemeId) {
  const currentIndex = THEME_OPTIONS.findIndex(
    (theme) => theme.id === currentTheme
  );
  const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
  return THEME_OPTIONS[(fallbackIndex + 1) % THEME_OPTIONS.length].id;
}
