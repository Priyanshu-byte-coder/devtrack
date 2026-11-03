import type { Metadata } from "next";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  CodingActivityInsights,
  CodingTime,
  ConsistencyScore,
  ContributionHeatmap,
  LocalCodingTime,
  ProductiveHours,
  StreakTracker,
  WeeklySummary,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        title="Activity"
        description="How often, how consistently and when you code."
      />

      <SectionTitle>Contributions</SectionTitle>
      <ContributionHeatmap />

      <SectionTitle>Streaks &amp; consistency</SectionTitle>
      <div id="streaks" className="grid scroll-mt-20 gap-4 xl:grid-cols-2">
        <StreakTracker />
        <div className="space-y-4">
          <WeeklySummary />
          <ConsistencyScore />
        </div>
      </div>

      <SectionTitle>When you code</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <ProductiveHours />
        <CodingActivityInsights />
      </div>

      <SectionTitle>Coding time</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <CodingTime />
        <LocalCodingTime />
      </div>
    </>
  );
}
