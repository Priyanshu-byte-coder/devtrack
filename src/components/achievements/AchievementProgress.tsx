"use client";

import React from "react";

interface AchievementProgressProps {
  current: number;
  total: number;
  label?: string;
}

export default function AchievementProgress({ current, total, label }: AchievementProgressProps) {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="w-full mt-3">
      <div className="flex justify-between items-center text-[10px] text-[var(--muted-foreground)] mb-1.5">
        <span className="font-medium">{label || "Progress"}</span>
        <span>{current} / {total} ({Math.round(percentage)}%)</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--card-muted)] rounded-full overflow-hidden">
        <div 
          className="h-full bg-[var(--accent)] transition-all duration-500 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
