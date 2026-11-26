import type { Metadata } from "next";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import TodayFocusHero from "@/components/TodayFocusHero";
import {
  Achievements,
  DailyNote,
  GoalTracker,
  MilestonePlanner,
} from "@/components/dashboard/widgets";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const t = await getTranslations("goals");

  return (
    <>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <GoalTracker />
        </div>
        <div className="min-w-0 space-y-4">
          <TodayFocusHero />
          <DailyNote />
        </div>
      </div>

      <SectionTitle>{t("sections.milestonesAndAchievements")}</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <MilestonePlanner />
        <Achievements />
      </div>
    </>
  );
}
