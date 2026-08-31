"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import type { AchievementEstimate } from "@/lib/achievement-estimators";

export default function AchievementProgressTracker() {
  const [estimates, setEstimates] = useState<AchievementEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEstimates() {
      try {
        const res = await fetch("/api/metrics/achievement-progress");
        if (!res.ok) throw new Error("Failed to load achievement progress");
        const data = await res.json();
        setEstimates(data.estimates || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading estimates");
      } finally {
        setLoading(false);
      }
    }
    loadEstimates();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
          Achievement Progress
        </h2>
        <div className="space-y-4" role="status" aria-label="Loading achievements" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (error || estimates.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
          Achievement Progress
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {error ? error : "No achievement estimates available at this time."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        Achievement Progress Estimator
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {estimates.map((est) => (
          <div key={est.slug} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--card-foreground)]">
                {est.title}
              </span>
              <span className="text-xs font-medium text-[var(--muted-foreground)] bg-[var(--card-muted)] px-2 py-1 rounded-full">
                {est.nextTier === null ? "Maxed" : `${est.current} / ${est.nextTier}`}
              </span>
            </div>
            <Progress value={est.percentage} className="h-2.5" />
            <p className="text-xs text-[var(--muted-foreground)]">
              {est.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
