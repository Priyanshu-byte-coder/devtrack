export type ThemeId =
  | "classic-dark"
  | "modern-light-blue"
  | "nordic-frost"
  | "cyberpunk-matrix";

export type ThemeMode = "light" | "dark";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  mode: ThemeMode;
};

export const THEME_STORAGE_KEY = "theme";

export const THEME_OPTIONS: ThemeDefinition[] = [
  {
    id: "classic-dark",
    name: "Classic Dark",
    description: "OLED black, high contrast",
    mode: "dark",
  },
  {
    id: "modern-light-blue",
    name: "Modern Light Blue",
    description: "Soft light surfaces, pastel blue accents",
    mode: "light",
  },
  {
    id: "nordic-frost",
    name: "Nordic Frost",
    description: "Slate navy with cyan-mint accents",
    mode: "dark",
  },
  {
    id: "cyberpunk-matrix",
    name: "Cyberpunk / Matrix",
    description: "Neon-fueled futuristic contrast",
    mode: "dark",
  },
];

export const DEFAULT_THEME: ThemeId = "classic-dark";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value) && THEME_OPTIONS.some((theme) => theme.id === value);
}

export function getThemeDefinition(themeId: ThemeId) {
  return THEME_OPTIONS.find((theme) => theme.id === themeId) ?? THEME_OPTIONS[0];
}

export function isDarkTheme(themeId: ThemeId) {
  return getThemeDefinition(themeId).mode === "dark";
}

export function nextThemeId(currentTheme: ThemeId) {
  const currentIndex = THEME_OPTIONS.findIndex((theme) => theme.id === currentTheme);
  const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
  return THEME_OPTIONS[(fallbackIndex + 1) % THEME_OPTIONS.length].id;
}
