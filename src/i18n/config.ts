export const locales = ["en", "es"] as const;

export type AppLocale = (typeof locales)[number];
export type LocaleDirection = "ltr" | "rtl";

export const defaultLocale: AppLocale = "en";

export const localeCookieName = "devtrack-locale";
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export const localeMetadata: Record<
  AppLocale,
  { label: string; nativeLabel: string; direction: LocaleDirection }
> = {
  en: {
    label: "English",
    nativeLabel: "English",
    direction: "ltr",
  },
  es: {
    label: "Spanish",
    nativeLabel: "Español",
    direction: "ltr",
  },
};

export function isValidLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && locales.includes(value as AppLocale);
}

export function getLocaleDirection(locale: AppLocale): LocaleDirection {
  return localeMetadata[locale]?.direction ?? localeMetadata[defaultLocale].direction;
}
