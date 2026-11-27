"use client";

import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("repoComparison.error");
  return (
    <div style={{ padding: 20 }}>
      <h2>{t("heading")}</h2>
      <p>{error.message}</p>
      <button onClick={() => reset()}>{t("tryAgain")}</button>
    </div>
  );
}
