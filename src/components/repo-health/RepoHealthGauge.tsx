"use client";

import { memo } from "react";

interface Props {
  score: number;
  grade: "green" | "yellow" | "red";
}

const GRADE_COLOR: Record<string, string> = {
  green: "var(--accent)",
  yellow: "#ca8a04",
  red: "var(--destructive)",
};

/**
 * Semi-circle SVG gauge that displays the 0-100 composite health score.
 *
 * The filled arc grows from left (0) to right (100) along the top of the
 * semi-circle.  Implemented with an SVG path so it works without any
 * charting library dependency and remains accessible to screen readers.
 */
function RepoHealthGauge({ score, grade }: Props) {
  // Geometry constants
  const CX = 100;
  const CY = 95;
  const R = 72;
  const STROKE = 14;

  const pct = Math.max(0, Math.min(1, score / 100));

  // Standard-math polar → SVG cartesian (SVG y-axis is flipped)
  const polar = (deg: number) => ({
    x: CX + R * Math.cos((deg * Math.PI) / 180),
    y: CY - R * Math.sin((deg * Math.PI) / 180),
  });

  // Track arc: full 180° semi-circle from left (180°) to right (0°)
  const tl = polar(180);
  const tr = polar(0);
  const trackPath = `M ${tl.x} ${tl.y} A ${R} ${R} 0 1 0 ${tr.x} ${tr.y}`;

  // Fill arc: from left (180°) to (180° − pct×180°)
  let fillPath: string | null = null;
  if (pct > 0) {
    if (pct >= 1) {
      fillPath = trackPath;
    } else {
      const endAngle = 180 - pct * 180;
      const fe = polar(endAngle);
      // Arc spans pct×180° which is always < 180°, so large-arc = 0
      fillPath = `M ${tl.x} ${tl.y} A ${R} ${R} 0 0 0 ${fe.x.toFixed(2)} ${fe.y.toFixed(2)}`;
    }
  }

  const color = GRADE_COLOR[grade] ?? GRADE_COLOR.red;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox="20 15 160 95"
        className="w-full max-w-[200px]"
        role="img"
        aria-label={`Repository health score: ${score} out of 100`}
      >
        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Filled arc (score portion) */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}

        {/* Score text */}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="26"
          fontWeight="700"
          fill={color}
          aria-hidden="true"
        >
          {score}
        </text>

        {/* "/ 100" label */}
        <text
          x={CX}
          y={CY + 18}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fill="var(--muted-foreground)"
          aria-hidden="true"
        >
          out of 100
        </text>
      </svg>
    </div>
  );
}

export default memo(RepoHealthGauge);
