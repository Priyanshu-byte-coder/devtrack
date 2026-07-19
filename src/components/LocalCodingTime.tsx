"use client";

import { useEffect, useState } from "react";

const DATA_WINDOW_DAYS = 90;
const dataWindowLabel = `Last ${DATA_WINDOW_DAYS} days`;


interface DailyData {
  date: string;
  totalSeconds: number;
  fileCount: number;
  projectCount: number;
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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function LocalCodingTime() {
  const [data, setData] = useState<{
    dailyData: DailyData[];
    totals: {
      totalSeconds: number;
      totalDays: number;
      avgSecondsPerDay: number;
    };
    hasData: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`/api/local-coding/stats?days=${days}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [days]);

  if (loading) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-40 rounded bg-[var(--card-muted)] animate-pulse" />
        <div className="h-8 w-28 rounded bg-[var(--card-muted)] animate-pulse" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded bg-[var(--card-muted)] animate-pulse"
          />
        ))}
      </div>

      <div className="space-y-2">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-[var(--card-muted)] animate-pulse"
          />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <div className="mx-auto h-3 w-52 rounded bg-[var(--card-muted)] animate-pulse" />
      </div>
    </div>
  );
}

  if (!data || !data.hasData) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Local Coding Time
          </h2>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-[var(--control)] border border-[var(--border)] rounded px-2 py-1 text-sm text-[var(--foreground)]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg
            className="w-12 h-12 text-[var(--muted-foreground)] mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-[var(--muted-foreground)] mb-2">
            No local coding data yet
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Install the DevTrack VS Code extension to track your coding time
          </p>
        </div>
      </div>
    );
  }

  const maxSeconds = Math.max(...data.dailyData.map((d) => d.totalSeconds), 1);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
          Local Coding Time
        </h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-[var(--control)] border border-[var(--border)] rounded px-2 py-1 text-sm text-[var(--foreground)]"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 stagger-children">
        <div className="text-center stat-cell rounded-lg p-2 animate-fade-in-up">
          <div className="text-2xl font-bold text-[var(--card-foreground)]">
            {formatDuration(data.totals.totalSeconds)}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">
            Total time
          </div>
        </div>
        <div className="text-center stat-cell rounded-lg p-2 animate-fade-in-up">
          <div className="text-2xl font-bold text-[var(--card-foreground)]">
            {data.totals.totalDays}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">
            Active days
          </div>
        </div>
        <div className="text-center stat-cell rounded-lg p-2 animate-fade-in-up">
          <div className="text-2xl font-bold text-[var(--card-foreground)]">
            {formatDuration(data.totals.avgSecondsPerDay)}
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">
            Daily avg
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {data.dailyData.slice(0, 14).map((day) => {
          const pct = (day.totalSeconds / maxSeconds) * 100;
          return (
            <div key={day.date} className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)] w-10">
                {formatDate(day.date)}
              </span>
              <div className="flex-1 h-4 bg-[var(--control)] rounded overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-[var(--muted-foreground)] w-12 text-right">
                {formatDuration(day.totalSeconds)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--muted-foreground)] text-center">
          Track your coding time with the DevTrack VS Code extension
        </p>
      </div>
    </div>
  );
}
