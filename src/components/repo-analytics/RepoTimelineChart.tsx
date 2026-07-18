"use client";

import { BarChart, Bar, LineChart, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { TimelinePoint } from "@/lib/repo-analytics-types";

export default function RepoTimelineChart({ timeline }: { timeline: TimelinePoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div
        className="h-52 rounded-xl border border-[var(--border)] p-3"
        style={{ backgroundColor: "color-mix(in srgb, var(--card) 40%, transparent)" }}
      >
        <ResponsiveContainer>
          <LineChart data={timeline}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis width={28} stroke="var(--muted-foreground)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--card-foreground)",
              }}
              labelStyle={{
                color: "var(--card-foreground)",
              }}
              itemStyle={{
                color: "var(--card-foreground)",
              }}
            />
            <Line
              type="monotone"
              dataKey="events"
              name="Commits"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div
        className="h-52 rounded-xl border border-[var(--border)] p-3"
        style={{ backgroundColor: "color-mix(in srgb, var(--card) 40%, transparent)" }}
      >
        <ResponsiveContainer>
          <BarChart data={timeline}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis width={28} stroke="var(--muted-foreground)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--card-foreground)",
              }}
              labelStyle={{
                color: "var(--card-foreground)",
              }}
              itemStyle={{
                color: "var(--card-foreground)",
              }}
            />
            <Bar
              dataKey="events"
              name="Commits"
              fill="var(--accent)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
