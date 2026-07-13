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
import { toast } from "sonner";
import { SkeletonBlock } from "./WidgetSkeleton";

interface DaySummary {
  date: string; // "YYYY-MM-DD"
  totalMinutes: number;
}

interface ChartDay {
  label: string;
  minutes: number;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

function formatMinutesLabel(minutes: number): string {
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours === 0 ? `${mins}m` : `${hours}h ${mins}m`;
}

export default function DailyTimeWidget() {
  const [data, setData] = useState<ChartDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/time-entries/summary")
      .then((r) => r.json())
      .then((res: { days: DaySummary[] }) => {
        const days = res.days ?? [];
        setData(
          days.map((d) => ({
            label: formatDayLabel(d.date),
            minutes: d.totalMinutes,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to fetch daily time summary:", err);
        setError("We couldn't load your time tracking summary right now.");
        toast.error("Failed to load time tracking summary");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Time Logged (Last 7 Days)
        </h2>
      </div>

      <p className="text-sm text-[var(--muted-foreground)] mb-6 h-5">
        {!loading && !error && totalMinutes > 0 && `${formatMinutesLabel(totalMinutes)} total this week`}
      </p>

      <div className="flex-1 min-h-[220px]">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="flex h-full items-end space-x-3 pb-2"
          >
            <span className="sr-only">Loading time tracking summary</span>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkeletonBlock key={i} className="flex-1 h-24" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)] text-center">
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchSummary}
                className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
              >
                Try again
              </button>
            </div>
          </div>
        ) : totalMinutes === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              No time logged in the last 7 days.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.4}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                style={{ fill: "var(--muted-foreground)", fontSize: "0.75rem" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatMinutesLabel}
                style={{ fill: "var(--muted-foreground)", fontSize: "0.75rem" }}
              />
              <Tooltip
                cursor={{ fill: "var(--card-muted)", opacity: 0.4 }}
                formatter={(value: number) => [formatMinutesLabel(value), "Logged"]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--card-foreground)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                itemStyle={{ color: "var(--accent)" }}
              />
              <Bar dataKey="minutes" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
