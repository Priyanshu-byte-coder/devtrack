import { getRequestConfig } from "next-intl/server";
import { getRequestLocale } from "./locale";
import { getMessagesForLocale } from "./messages";

export default getRequestConfig(async () => {
  const locale = await getRequestLocale();

  return {
    locale,
    messages: await getMessagesForLocale(locale),
  };
});
