"use client";

import { memo } from "react";
import type { BreakdownRow } from "@/lib/repo-health-insights";

interface Props {
  rows: BreakdownRow[];
}

function ScoreBar({ pct }: { pct: number }) {
  const color =
    pct >= 70
      ? "bg-[var(--accent)]"
      : pct >= 40
        ? "bg-[#ca8a04]"
        : "bg-[var(--destructive)]";

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Tabular breakdown of the five health-score dimensions.
 *
 * Each row shows:
 *   – Metric label
 *   – Raw signal value (formatted)
 *   – Earned / max score
 *   – Progress bar proportional to earned / max
 *   – Weight contribution to the 100-point total
 *   – Tooltip with target description
 */
function RepoHealthBreakdown({ rows }: Props) {
  return (
    <section aria-label="Score breakdown">
      <h3 className="mb-3 text-sm font-semibold text-[var(--card-foreground)]">
        Score Breakdown
      </h3>

      <div className="space-y-4">
        {rows.map((row) => {
          const pct = Math.round((row.earned / row.maxScore) * 100);
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                {/* Metric name + tooltip */}
                <span
                  className="font-medium text-[var(--card-foreground)] cursor-help"
                  title={row.tip}
                >
                  {row.label}
                </span>

                <span className="shrink-0 flex items-center gap-2 tabular-nums text-[var(--muted-foreground)]">
                  {/* Raw signal value */}
                  <span
                    className="rounded bg-[var(--control)] px-1.5 py-0.5 font-mono"
                    aria-label={`Measured value: ${row.rawValue}`}
                  >
                    {row.rawValue}
                  </span>

                  {/* Earned / max */}
                  <span aria-label={`${row.earned} of ${row.maxScore} points`}>
                    <span className="font-semibold text-[var(--card-foreground)]">
                      {row.earned}
                    </span>
                    <span>/{row.maxScore}</span>
                    <span className="ml-1 text-[var(--muted-foreground)]/70">
                      ({row.weightPct}%)
                    </span>
                  </span>
                </span>
              </div>

              <ScoreBar pct={pct} />
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Hover metric names for target thresholds. Total weight: 100 pts.
      </p>
    </section>
  );
}

export default memo(RepoHealthBreakdown);
