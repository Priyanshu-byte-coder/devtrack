import { defaultLocale, isValidLocale, type AppLocale } from "./config";

type Messages = Record<string, unknown>;

function readKey(messages: Messages, key: string): string | undefined {
  let current: unknown = messages;

  for (const part of key.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Messages)[part];
  }

  return typeof current === "string" ? current : undefined;
}

export async function translateMessage(locale: string, key: string): Promise<string> {
  const fallback = (await import("../../messages/en.json")).default as Messages;
  const resolvedLocale: AppLocale = isValidLocale(locale) ? locale : defaultLocale;

  if (resolvedLocale === defaultLocale) {
    return readKey(fallback, key) ?? key;
  }

  const messages = (await import(`../../messages/${resolvedLocale}.json`)).default as Messages;
  return readKey(messages, key) ?? readKey(fallback, key) ?? key;
}
