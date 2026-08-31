import "server-only";

import type { AbstractIntlMessages } from "next-intl";
import { defaultLocale, isValidLocale, type AppLocale } from "./config";

type Messages = AbstractIntlMessages;

function mergeMessages(fallback: Messages, messages: Messages): Messages {
  const merged: Record<string, string | AbstractIntlMessages> = { ...fallback };

  for (const [key, value] of Object.entries(messages)) {
    const fallbackValue = fallback[key];
    if (
      value &&
      fallbackValue &&
      typeof value === "object" &&
      typeof fallbackValue === "object" &&
      !Array.isArray(value) &&
      !Array.isArray(fallbackValue)
    ) {
      merged[key] = mergeMessages(fallbackValue as Messages, value as Messages);
    } else {
      merged[key] = value as string | AbstractIntlMessages;
    }
  }

  return merged as Messages;
}

async function importMessages(locale: AppLocale): Promise<Messages> {
  return (await import(`../../messages/${locale}.json`)).default as Messages;
}

export async function getMessagesForLocale(locale: string): Promise<Messages> {
  const resolvedLocale = isValidLocale(locale) ? locale : defaultLocale;
  const fallbackMessages = await importMessages(defaultLocale);

  if (resolvedLocale === defaultLocale) {
    return fallbackMessages;
  }

  const localeMessages = await importMessages(resolvedLocale);
  return mergeMessages(fallbackMessages, localeMessages);
}
