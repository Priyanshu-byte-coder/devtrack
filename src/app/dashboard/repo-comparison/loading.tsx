"use client";

import { useTranslations } from "next-intl";
import PixelLoader from "@/components/buddy/PixelLoader";

export default function Loading() {
  const t = useTranslations("repoComparison.loading");
  return <PixelLoader label={t("label")} />;
}
