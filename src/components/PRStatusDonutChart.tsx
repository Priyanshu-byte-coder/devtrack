// @ts-nocheck
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";

interface PRStatusDonutChartProps {
  open: number;
  merged: number;
  closed: number;
}

interface ChartEntry {
  name: string;
  value: number;
}

const COLORS = [
  "var(--accent)",           // Open
  "var(--success)",          // Merged — emerald-500 via CSS token
  "var(--muted-foreground)", // Closed without merge
];

const LEGEND_LABELS: { label: string; color: string }[] = [
  { label: "Open", color: COLORS[0] },
  { label: "Merged", color: COLORS[1] },
  { label: "Closed", color: COLORS[2] },
];

function CenterLabel({
  cx,
  cy,
  total,
}: {
  cx: number;
  cy: number;
  total: number;
}) {
  return (
    <>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          fill: "var(--card-foreground)",
        }}
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: "0.7rem",
          fill: "var(--muted-foreground)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        PRs total
      </text>
    </>
  );
}

function CustomTooltip({
  active,
  payload,
  total,
}: any) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const value = entry.value ?? 0;
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div
      style={{
        background: "var(--tooltip)",
        color: "var(--tooltip-foreground)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
        padding: "0.5rem 0.75rem",
        fontSize: "0.8rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ fontWeight: 600 }}>{entry.name}</span>
      <br />
      {value} PR{value !== 1 ? "s" : ""} ({pct}%)
    </div>
  );
}

export default function PRStatusDonutChart({
  open,
  merged,
  closed,
}: PRStatusDonutChartProps) {
  const total = open + merged + closed;
  const hasNoActivity = total === 0;

  const data: ChartEntry[] = [
    { name: "Open", value: open },
    { name: "Merged", value: merged },
    { name: "Closed", value: closed },
  ];

  // If all values are 0 show a placeholder slice so the chart renders
  const chartData =
    total === 0 ? [{ name: "No PRs", value: 1 }] : data;
  const chartColors = total === 0 ? ["var(--card-muted)"] : COLORS;

  return (
    <div className="flex flex-col items-center w-full">
      {hasNoActivity && (
      <p className="mb-4 text-sm text-[var(--muted-foreground)] text-center">
        No pull request activity yet. Start contributing on GitHub to see your analytics here.
      </p>
        )}
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={92}
            dataKey="value"
            labelLine={false}
            label={false}
            strokeWidth={0}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={chartColors[index % chartColors.length]}
              />
            ))}
          </Pie>

          {/* SVG center label rendered as a foreign overlay via Recharts customized label */}
          <Pie
            data={[{ value: 1 }]}
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={0}
            dataKey="value"
            labelLine={false}
            label={({ cx, cy }: { cx: number; cy: number }) => (
              <CenterLabel cx={cx} cy={cy} total={total} />
            )}
          >
            <Cell fill="transparent" />
          </Pie>

          <Tooltip
            content={(props: any) => (
              <CustomTooltip {...props} total={total} />
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <div className="flex gap-5 mt-1 flex-wrap justify-center">
        {LEGEND_LABELS.map(({ label, color }, i) => {
          const val = data[i]?.value ?? 0;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {label}{" "}
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--card-foreground)",
                  }}
                >
                  {val}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
