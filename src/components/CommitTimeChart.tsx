// @ts-nocheck
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Sun, Cloud, Sunset, Moon } from "lucide-react";
import { toast } from "sonner";
import { SkeletonBlock } from "./WidgetSkeleton";

interface TimeBlocks {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
}

interface ChartData {
  name: string;
  commits: number;
  icon: React.ComponentType<any>;
  key: string;
}

export default function CommitTimeChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [peakTime, setPeakTime] = useState<string | null>(null);

  const fetchContributions = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/metrics/contributions?days=${days}`)
      .then((r) => r.json())
      .then((res: { timeBlocks: TimeBlocks }) => {
        if (!res.timeBlocks) {
          setData([]);
          setPeakTime(null);
          return;
        }

        const blocks = res.timeBlocks;
        const chartData: ChartData[] = [
          {
            name: "Morning (6-12)",
            commits: blocks.morning,
            icon: Sun,
            key: "morning",
          },
          {
            name: "Afternoon (12-18)",
            commits: blocks.afternoon,
            icon: Cloud,
            key: "afternoon",
          },
          {
            name: "Evening (18-22)",
            commits: blocks.evening,
            icon: Sunset,
            key: "evening",
          },
          {
            name: "Night (22-6)",
            commits: blocks.night,
            icon: Moon,
            key: "night",
          },
        ];

        let peak = chartData[0];
        for (const block of chartData) {
          if (block.commits > peak.commits) {
            peak = block;
          }
        }

        setData(chartData);
        setPeakTime(peak.commits > 0 ? peak.name : null);
      })
      .catch((err) => {
        console.error("Failed to fetch commit time data:", err);
        setError("We couldn't load your time-of-day data right now.");
        toast.error("Failed to load time-of-day data");
      })
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Commits by Time of Day
        </h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-2 py-1 text-sm text-[var(--card-foreground)]"
        >
          <option value={7}>Last 7d</option>
          <option value={30}>Last 30d</option>
          <option value={90}>Last 90d</option>
        </select>
      </div>

      <p className="text-sm text-[var(--muted-foreground)] mb-6 h-5">
        {peakTime &&
          `You commit most frequently in the ${peakTime.split(" ")[0].toLowerCase()}`}
      </p>

      <div className="flex-1 min-h-[250px]">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="flex h-full flex-col justify-end space-y-3 pt-6 pb-2"
          >
            <span className="sr-only">Loading commit time chart</span>
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)] text-center">
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchContributions}
                className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
              >
                Try again
              </button>
            </div>
          </div>
        ) : data.every((d) => d.commits === 0) ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No commits in the last {days} days.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="var(--border)"
                opacity={0.4}
              />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                tickFormatter={(value) => value.split(" ")[0]}
                style={{ fill: "var(--muted-foreground)", fontSize: "0.8rem" }}
              />
              <Tooltip
                cursor={{ fill: "var(--card-muted)", opacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--card-foreground)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                itemStyle={{ color: "var(--accent)" }}
              />
              <Bar
                dataKey="commits"
                fill="var(--accent)"
                radius={[0, 4, 4, 0]}
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
