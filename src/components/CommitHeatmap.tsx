"use client";

import { useEffect, useState } from "react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12am";
  if (i === 12) return "12pm";
  return i < 12 ? `${i}am` : `${i - 12}pm`;
});

interface CommitTimesData {
  matrix: number[][];
  peakDay: number;
  peakHour: number;
  peakCount: number;
}

interface TooltipState {
  visible: boolean;
  day: number;
  hour: number;
  count: number;
  x: number;
  y: number;
}

function getColor(count: number, max: number): string {
  if (count === 0) return "var(--card-muted, #1e1e2e)";
  const intensity = max > 0 ? count / max : 0;
  if (intensity < 0.2) return "#14532d";
  if (intensity < 0.4) return "#166534";
  if (intensity < 0.6) return "#15803d";
  if (intensity < 0.8) return "#16a34a";
  return "#22c55e";
}

export default function CommitHeatmap() {
  const [data, setData] = useState<CommitTimesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    day: 0,
    hour: 0,
    count: 0,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    setLoading(true);
    fetch("/api/metrics/commit-times")
      .then((r) => r.json())
      .then((res: CommitTimesData) => {
        if (res.matrix) setData(res);
        else setError("No data returned");
      })
      .catch(() => setError("Failed to load commit times"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm"
        role="status"
        aria-busy="true"
        aria-label="Loading commit heatmap"
      >
        <div className="h-6 w-52 bg-[var(--card-muted)] rounded mb-4 animate-pulse" />
        <div className="h-40 bg-[var(--card-muted)] rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-sm text-[var(--muted-foreground)]">
          {error ?? "No commit time data available."}
        </p>
      </div>
    );
  }

  const max = Math.max(...data.matrix.flat());
  const peakLabel =
    data.peakCount > 0
      ? `You code most on ${FULL_DAY_LABELS[data.peakDay]}s at ${HOUR_LABELS[data.peakHour]} (${data.peakCount} commits)`
      : "Not enough data to determine peak coding time.";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">
        Commit Time Heatmap
      </h2>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">
        When during the week you push code — last 90 days
      </p>

      <div className="relative overflow-x-auto">
        {/* Hour axis labels — shown every 3 hours */}
        <div
          className="flex mb-1"
          aria-hidden="true"
          style={{ paddingLeft: "2.5rem" }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="text-[9px] text-[var(--muted-foreground)] text-center"
              style={{ width: "1.25rem", flexShrink: 0 }}
            >
              {h % 3 === 0 ? HOUR_LABELS[h] : ""}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {data.matrix.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center mb-[3px]">
            {/* Day label */}
            <span
              className="text-[10px] text-[var(--muted-foreground)] w-10 shrink-0 text-right pr-2"
              aria-label={FULL_DAY_LABELS[dayIdx]}
            >
              {DAY_LABELS[dayIdx]}
            </span>

            {/* Hour cells */}
            {row.map((count, hourIdx) => (
              <div
                key={hourIdx}
                role="gridcell"
                tabIndex={0}
                aria-label={`${FULL_DAY_LABELS[dayIdx]} ${HOUR_LABELS[hourIdx]}: ${count} commit${count !== 1 ? "s" : ""}`}
                style={{
                  width: "1.25rem",
                  height: "1.25rem",
                  backgroundColor: getColor(count, max),
                  flexShrink: 0,
                  borderRadius: "3px",
                  marginRight: "2px",
                  cursor: count > 0 ? "default" : "default",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setTooltip({
                    visible: true,
                    day: dayIdx,
                    hour: hourIdx,
                    count,
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                  });
                }}
                onMouseLeave={() =>
                  setTooltip((t) => ({ ...t, visible: false }))
                }
                onFocus={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setTooltip({
                    visible: true,
                    day: dayIdx,
                    hour: hourIdx,
                    count,
                    x: rect.left + window.scrollX,
                    y: rect.top + window.scrollY,
                  });
                }}
                onBlur={() =>
                  setTooltip((t) => ({ ...t, visible: false }))
                }
              />
            ))}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          role="tooltip"
          className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          {FULL_DAY_LABELS[tooltip.day]} {HOUR_LABELS[tooltip.hour]} —{" "}
          <span className="text-green-400 font-semibold">
            {tooltip.count} commit{tooltip.count !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Legend */}
      <div
        className="flex items-center gap-1 mt-4"
        aria-label="Color scale legend"
      >
        <span className="text-[10px] text-[var(--muted-foreground)] mr-1">
          Less
        </span>
        {["#1e1e2e", "#14532d", "#15803d", "#16a34a", "#22c55e"].map(
          (color) => (
            <div
              key={color}
              style={{
                width: "0.9rem",
                height: "0.9rem",
                backgroundColor: color,
                borderRadius: "2px",
              }}
              aria-hidden="true"
            />
          )
        )}
        <span className="text-[10px] text-[var(--muted-foreground)] ml-1">
          More
        </span>
      </div>

      {/* Peak stat */}
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        🔥{" "}
        <span className="text-[var(--foreground)] font-medium">{peakLabel}</span>
      </p>
    </div>
  );
}