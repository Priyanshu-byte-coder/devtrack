"use client";

import { HeatmapPoint } from "@/lib/repo-analytics-types";

const colorForCount = (count: number) => {
  if (count === 0) return "var(--card)";
  if (count <= 1) return "color-mix(in srgb, var(--accent) 25%, transparent)";
  if (count <= 3) return "color-mix(in srgb, var(--accent) 50%, transparent)";
  if (count <= 6) return "color-mix(in srgb, var(--accent) 75%, transparent)";
  return "var(--accent)";
};

export default function CommitHeatmap({ points }: { points: HeatmapPoint[] }) {
  return (
    <div className="grid grid-cols-10 gap-1 sm:grid-cols-[repeat(15,minmax(0,1fr))] md:grid-cols-[repeat(30,minmax(0,1fr))]">
      {points.map((point) => (
        <div key={point.date} title={`${point.date}: ${point.count} commits`} className="h-3 w-full rounded-sm" style={{ backgroundColor: colorForCount(point.count) }} />
      ))}
    </div>
  );
}
