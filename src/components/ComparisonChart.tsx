"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface WeeklyCommit {
  week: string;
  commits: number;
}

interface ComparisonChartProps {
  myUsername: string;
  friendUsername: string;
  myWeeklyCommits: WeeklyCommit[];
  friendWeeklyCommits: WeeklyCommit[];
}

function shortWeek(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

export default function ComparisonChart({
  myUsername,
  friendUsername,
  myWeeklyCommits,
  friendWeeklyCommits,
}: ComparisonChartProps) {
  // Merge both datasets on week key
  const weekMap = new Map<string, { week: string; me: number; friend: number }>();

  for (const w of myWeeklyCommits) {
    weekMap.set(w.week, { week: w.week, me: w.commits, friend: 0 });
  }
  for (const w of friendWeeklyCommits) {
    const existing = weekMap.get(w.week);
    if (existing) {
      existing.friend = w.commits;
    } else {
      weekMap.set(w.week, { week: w.week, me: 0, friend: w.commits });
    }
  }

  const data = Array.from(weekMap.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((d) => ({ ...d, week: shortWeek(d.week) }));

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="mb-4 text-sm font-semibold text-[var(--card-foreground)]">
        Weekly Commit Activity
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          barCategoryGap="20%"
          margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "var(--card-foreground)",
            }}
            labelStyle={{ fontWeight: 600 }}
            cursor={{ fill: "var(--control)", opacity: 0.6 }}
          />
          <Legend
            formatter={(value: string) =>
              value === "me" ? `@${myUsername}` : `@${friendUsername}`
            }
            wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
          />
          <Bar dataKey="me" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="friend" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
