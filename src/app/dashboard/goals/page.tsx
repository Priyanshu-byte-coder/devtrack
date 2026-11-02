import type { Metadata } from "next";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import TodayFocusHero from "@/components/TodayFocusHero";
import {
  Achievements,
  DailyNote,
  GoalTracker,
  MilestonePlanner,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Goals · DevTrack" };

export default function GoalsPage() {
  return (
    <>
      <PageHeader
        title="Goals"
        description="What you are aiming for, and how far along you are."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <GoalTracker />
        </div>
        <div className="min-w-0 space-y-4">
          <TodayFocusHero />
          <DailyNote />
        </div>
      </div>

      <SectionTitle>Milestones &amp; achievements</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <MilestonePlanner />
        <Achievements />
      </div>
    </>
  );
}
