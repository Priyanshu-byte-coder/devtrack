import { defaultLocale, isValidLocale, type AppLocale } from "./config";

type LocaleSource = "preference" | "cookie" | "browser" | "default";

export type LocaleResolution = {
  locale: AppLocale;
  source: LocaleSource;
};

export function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  const [language] = value.trim().toLowerCase().split("-");
  return isValidLocale(language) ? language : null;
}

export function detectLocale(options: {
  preferredLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): LocaleResolution {
  const preferredLocale = normalizeLocale(options.preferredLocale);
  if (preferredLocale) {
    return { locale: preferredLocale, source: "preference" };
  }

  const cookieLocale = normalizeLocale(options.cookieLocale);
  if (cookieLocale) {
    return { locale: cookieLocale, source: "cookie" };
  }

  const browserLocale = detectBrowserLocale(options.acceptLanguage);
  if (browserLocale) {
    return { locale: browserLocale, source: "browser" };
  }

  return { locale: defaultLocale, source: "default" };
}

export function detectBrowserLocale(acceptLanguage: string | null | undefined): AppLocale | null {
  if (!acceptLanguage) return null;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, quality = "q=1"] = part.trim().split(";");
      const q = Number(quality.replace(/^q=/, ""));
      return { tag, q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate.tag);
    if (locale) return locale;
  }

  return null;
}
