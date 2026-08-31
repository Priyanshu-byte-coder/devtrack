// @ts-nocheck
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { LanguageSlice } from "@/lib/repo-analytics-types";

export default function RepoLanguagePie({ data }: { data: LanguageSlice[] }) {
  if (!data.length) {
    return <div className="h-24 w-full rounded-lg bg-white/5" />;
  }

  return (
    <div className="h-24 w-full min-w-0">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="percentage" nameKey="name" innerRadius={20} outerRadius={35} paddingAngle={2} isAnimationActive animationDuration={700}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--card-foreground)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--card-foreground)" }}
            itemStyle={{ color: "var(--card-foreground)" }}
            formatter={(value: any, name: any) => [`${value} repos`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
