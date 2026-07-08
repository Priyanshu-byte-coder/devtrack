"use client";

import ContributionHeatmapCalendar from "@/components/ContributionHeatmapCalendar";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";
import type { ContributionData } from "@/lib/public-profile-data";

interface PublicContributionHeatmapProps {
  data: ContributionData;
}

export default function PublicContributionHeatmap({ data: contributionData }: PublicContributionHeatmapProps) {
  const { themeConfig } = useHeatmapTheme();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Contribution Heatmap
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {contributionData.total} contributions in the last {contributionData.days} days
          </p>
        </div>
      </div>

      {Object.keys(contributionData.data ?? {}).length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No commit data available.</p>
      ) : (
        <ContributionHeatmapCalendar
          data={contributionData.data}
          days={contributionData.days}
          themeConfig={themeConfig}
        />
      )}
    </div>
  );
}
