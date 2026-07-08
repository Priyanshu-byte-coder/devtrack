"use client";

import React from "react";

interface GoalProgressBarProps {
  current: number;
  target: number;
  completed: boolean;
}

export default function GoalProgressBar({ current, target, completed }: GoalProgressBarProps) {
  const pct = target > 0 ? Math.max(0, Math.min(Math.round((current / target) * 100), 100)) : 0;
  
  let statusColor = "bg-[var(--accent)]";
  let statusLabel = "Not Started";
  
  if (completed) {
    statusColor = "bg-emerald-500";
    statusLabel = "Completed";
  } else if (pct > 0 && pct < 80) {
    statusColor = "bg-blue-500";
    statusLabel = "In Progress";
  } else if (pct >= 80) {
    statusColor = "bg-orange-500";
    statusLabel = "Near Completion";
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 text-xs font-medium">
        <span className="text-[var(--muted-foreground)]">{statusLabel}</span>
        <span className="text-[var(--foreground)]">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--control)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={`Goal progress: ${current} of ${target}`}
        />
      </div>
    </div>
  );
}
