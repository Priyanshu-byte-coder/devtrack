import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  CodingActivityInsights,
  ConsistencyScore,
  ContributionHeatmap,
  ProductiveHours,
  StreakTracker,
  WeeklySummary,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const t = await getTranslations("activity");

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <SectionTitle>{t("sections.contributions")}</SectionTitle>
      <ContributionHeatmap />

      <SectionTitle>{t("sections.streaksAndConsistency")}</SectionTitle>
      <div id="streaks" className="grid scroll-mt-20 gap-4 xl:grid-cols-2">
        <StreakTracker />
        <div className="space-y-4">
          <WeeklySummary />
          <ConsistencyScore />
        </div>
      </div>

      <SectionTitle>{t("sections.whenYouCode")}</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <ProductiveHours />
        <CodingActivityInsights />
      </div>
    </>
  );
}
