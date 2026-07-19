"use client";

import { RepoHealth } from "@/lib/repo-analytics-types";

const meterColor = (value: number) => (value >= 75 ? "bg-[var(--success)]" : value >= 45 ? "bg-[var(--warning)]" : "bg-[var(--error)]");

export default function RepoHealthMetrics({ health }: { health: RepoHealth }) {
  const metrics = [
    { label: "Commit consistency", value: Math.min(100, Math.round((health.signals?.commitFrequency || 0) * 5)) },
    { label: "PR merge efficiency", value: Math.round((health.signals?.prMergeRate || 0) * 100) },
    { label: "Maintenance score", value: health.score },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--card-foreground)]">Development activity</span>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted-foreground)] capitalize">{health.grade || "neutral"}</span>
      </div>
      {metrics.map((metric) => (
        <div key={metric.label}>
          <div className="mb-1 flex justify-between text-xs text-[var(--muted-foreground)]">
            <span>{metric.label}</span>
            <span>{metric.value}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
            <div className={`h-full ${meterColor(metric.value)}`} style={{ width: `${metric.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
