import { cookies, headers } from "next/headers";
import { localeCookieName, type AppLocale } from "./config";
import { detectLocale } from "./detection";

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  return detectLocale({
    cookieLocale: cookieStore.get(localeCookieName)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  }).locale;
}
