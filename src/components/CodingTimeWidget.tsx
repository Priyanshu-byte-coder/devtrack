// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Clock } from "lucide-react";

interface CodingTimeData {
  hasData: boolean;
  not_configured?: boolean;
  todaysSeconds: number;
  totalSeconds7Days: number;
  chartData: { date: string; hours: number }[];
  topLanguage: string;
  topProject: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export default function CodingTimeWidget() {
  const [data, setData] = useState<CodingTimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/wakatime");
        const json = await res.json();
        setData(json);
      } catch (e) {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <div className="h-5 w-40 bg-[var(--card-muted)] rounded animate-pulse mb-4" />
        <div className="h-48 bg-[var(--card-muted)] rounded animate-pulse w-full" />
      </div>
    );
  }

  if (!data || data.not_configured || !data.hasData) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)] mb-4">
          Wakatime Coding Activity (7 Days)
        </h2>
        <div className="flex h-[240px] flex-col items-center justify-center text-center">
          <Clock
            className="mb-3 h-8 w-8 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--muted-foreground)]">
            Connect your WakaTime account to view coding statistics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="text-lg font-semibold text-[var(--card-foreground)] mb-4">
        Wakatime Coding Activity (7 Days)
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <div className="text-2xl font-bold text-[var(--card-foreground)]">
            {formatDuration(data.todaysSeconds)}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">Today</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--card-foreground)]">
            {formatDuration(data.totalSeconds7Days)}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">Last 7 Days</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--card-foreground)] truncate" title={data.topLanguage}>
            {data.topLanguage}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">Top Language</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-[var(--card-foreground)] truncate" title={data.topProject}>
            {data.topProject}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">Top Project</div>
        </div>
      </div>

      <div className="h-48 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              cursor={{ fill: "var(--control)" }}
              contentStyle={{ 
                backgroundColor: "var(--card)", 
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--card-foreground)",
              }}
              formatter={(value: any) => [`${value} hrs`, 'Time']}
              labelFormatter={(label) => formatDate(label as string)}
            />
            <Bar dataKey="hours" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
