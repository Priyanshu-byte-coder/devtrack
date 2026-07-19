"use client";

import { useEffect, useState, useRef } from "react";

interface HourData {
  hour: number;
  commits: number;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export default function ActivityRingChart() {
  const [data, setData] = useState<HourData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [hoveredHour, setHoveredHour] = useState<HourData | null>(null);
  const [animated, setAnimated] = useState(false);
  const prefersReduced = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    setAnimated(false);
    fetch(`/api/metrics/contributions/hourly?days=${days}`)
      .then((r) => r.json())
      .then((res: { hours?: HourData[] }) => {
        setData(res.hours ?? []);
        setTimeout(() => setAnimated(true), 50);
      })
      .catch(() => setError("Failed to load activity data."))
      .finally(() => setLoading(false));
  }, [days]);

  const maxCommits = Math.max(...data.map((d) => d.commits), 1);
  const peakHour = data.reduce(
    (a, b) => (b.commits > a.commits ? b : a),
    { hour: 0, commits: 0 }
  );

  const cx = 150;
  const cy = 150;
  const innerR = 55;
  const outerMaxR = 120;
  const segments = 24;
  const anglePerSegment = (2 * Math.PI) / segments;
  const gap = 0.04;

  function polarToCartesian(angle: number, r: number) {
    return {
      x: cx + r * Math.cos(angle - Math.PI / 2),
      y: cy + r * Math.sin(angle - Math.PI / 2),
    };
  }

  function segmentPath(index: number, outerR: number) {
    const startAngle = index * anglePerSegment + gap;
    const endAngle = (index + 1) * anglePerSegment - gap;
    const o1 = polarToCartesian(startAngle, outerR);
    const o2 = polarToCartesian(endAngle, outerR);
    const i1 = polarToCartesian(startAngle, innerR);
    const i2 = polarToCartesian(endAngle, innerR);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return [
      `M ${i1.x} ${i1.y}`,
      `L ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
      `L ${i2.x} ${i2.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i1.x} ${i1.y}`,
      "Z",
    ].join(" ");
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Activity Ring
        </h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm text-[var(--card-foreground)]"
        >
          <option value={7}>Last 7d</option>
          <option value={30}>Last 30d</option>
          <option value={90}>Last 90d</option>
        </select>
      </div>

      <p className="text-sm text-[var(--muted-foreground)] mb-4 h-5">
        {peakHour.commits > 0 &&
          `Most active at ${formatHour(peakHour.hour)} (${peakHour.commits} commits)`}
      </p>

      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        {loading ? (
          <div className="h-[300px] w-[300px] animate-pulse rounded-full bg-[var(--card-muted)]" />
        ) : error ? (
          <p className="text-sm text-[var(--destructive)]">{error}</p>
        ) : data.every((d) => d.commits === 0) ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No commits in the last {days} days.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <svg width="300" height="300" viewBox="0 0 300 300">
              {/* Hour labels */}
              {[0, 6, 12, 18].map((h) => {
                const angle = h * anglePerSegment - Math.PI / 2;
                const labelR = outerMaxR + 18;
                const x = cx + labelR * Math.cos(angle);
                const y = cy + labelR * Math.sin(angle);
                return (
                  <text
                    key={h}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="10"
                    fill="var(--muted-foreground)"
                  >
                    {formatHour(h)}
                  </text>
                );
              })}

              {/* Segments */}
              {data.map((d) => {
                const isPeak = d.hour === peakHour.hour && d.commits > 0;
                const isHovered = hoveredHour?.hour === d.hour;
                const ratio = d.commits / maxCommits;
                const targetR = d.commits === 0
                  ? innerR + 4
                  : innerR + (outerMaxR - innerR) * ratio;
                const currentR =
                  !prefersReduced.current && !animated ? innerR : targetR;

                return (
                  <path
                    key={d.hour}
                    d={segmentPath(d.hour, currentR)}
                    fill={
                      isPeak || isHovered
                        ? "var(--accent)"
                        : d.commits === 0
                        ? "var(--card-muted)"
                        : "var(--accent)"
                    }
                    opacity={
                      d.commits === 0
                        ? 0.15
                        : isPeak || isHovered
                        ? 1
                        : 0.5 + 0.5 * ratio
                    }
                    style={{
                      transition: prefersReduced.current
                        ? "none"
                        : "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      cursor: d.commits > 0 ? "pointer" : "default",
                    }}
                    onMouseEnter={() => setHoveredHour(d)}
                    onMouseLeave={() => setHoveredHour(null)}
                  />
                );
              })}

              {/* Center label */}
              <text
                x={cx}
                y={cy - 8}
                textAnchor="middle"
                fontSize="22"
                fontWeight="bold"
                fill="var(--card-foreground)"
              >
                {hoveredHour ? hoveredHour.commits : data.reduce((s, d) => s + d.commits, 0)}
              </text>
              <text
                x={cx}
                y={cy + 14}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {hoveredHour ? formatHour(hoveredHour.hour) : "commits"}
              </text>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}


