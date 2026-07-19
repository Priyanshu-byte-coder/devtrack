"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { useAccount } from "@/components/AccountContext";
import {
  isRecentlyActiveFromScore,
  type ConsistencyScoreResult,
} from "@/lib/consistency-score";

const GRADE_COLORS: Record<ConsistencyScoreResult["grade"], string> = {
  S: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  A: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  B: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  C: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  D: "bg-red-500/15 text-red-400 border-red-500/30",
};

const GRADE_RING_COLORS: Record<ConsistencyScoreResult["grade"], string> = {
  S: "var(--success, #10b981)",
  A: "#3b82f6",
  B: "#eab308",
  C: "#f97316",
  D: "var(--destructive, #ef4444)",
};

function CircularProgress({
  score,
  grade,
}: {
  score: number;
  grade: ConsistencyScoreResult["grade"];
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = GRADE_RING_COLORS[grade];

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--control)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--card-foreground)]">{score}</span>
        <span className="text-xs text-[var(--muted-foreground)]">/ 100</span>
      </div>
    </div>
  );
}

function ConsistencyScoreSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading consistency score"
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm flex flex-col h-full"
    >
      <div className="h-6 w-40 bg-[var(--card-muted)] rounded mb-6 animate-pulse" aria-hidden="true" />
      <div className="flex justify-center mb-6" aria-hidden="true">
        <div className="h-32 w-32 rounded-full bg-[var(--card-muted)] animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-[var(--card-muted)] rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-40 w-full bg-[var(--card-muted)] rounded-lg animate-pulse" aria-hidden="true" />
    </div>
  );
}

export default function ConsistencyScoreWidget() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<ConsistencyScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url =
        selectedAccount !== null
          ? `/api/metrics/consistency-score?accountId=${encodeURIComponent(selectedAccount)}`
          : "/api/metrics/consistency-score";
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error("Failed to fetch consistency score");
      }

      const json = (await res.json()) as ConsistencyScoreResult;
      setData(json);
    } catch (err) {
      console.error("Failed to fetch consistency score:", err);
      setError("We couldn't load your consistency score right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  useEffect(() => {
    const handleSync = () => {
      fetchScore();
    };
    window.addEventListener("devtrack:sync", handleSync);
    return () => window.removeEventListener("devtrack:sync", handleSync);
  }, [fetchScore]);

  if (loading) {
    return <ConsistencyScoreSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <SectionHeader title="Consistency Score" />
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchScore}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <SectionHeader title="Consistency Score" />
        <div className="flex h-[320px] flex-col items-center justify-center text-center">
          <BarChart3
            className="mb-3 h-8 w-8 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--muted-foreground)]">
            No contribution activity available.
          </p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Weekly Consistency",
      value: `${data.weeklyConsistency}%`,
    },
    {
      label: "Streak Quality",
      value: `${Math.round(data.streakQuality * 100)}%`,
    },
    {
      label: "Longest Gap",
      value: `${data.longestGap} days`,
    },
    {
      label: "Recent Activity",
      value: isRecentlyActiveFromScore(data) ? "Active" : "Inactive",
    },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader title="Consistency Score" />
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${GRADE_COLORS[data.grade]}`}
        >
          {data.grade}
        </span>
      </div>

      <div className="mb-6 flex justify-center">
        <CircularProgress score={data.score} grade={data.grade} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-[var(--control)] p-4 text-center"
          >
            <div className="text-lg font-bold text-[var(--accent)]">{stat.value}</div>
            <div className="mt-1 text-xs text-[var(--muted-foreground)]">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
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
              formatter={(value: number) => [`${value} days`, "Active Days"]}
            />
            <Bar dataKey="activeDays" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
        {data.improvementTip}
      </div>
    </div>
  );
}
