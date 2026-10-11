"use client";

import { useEffect, useState } from "react";
import WeeklyStatsCard from "./WeeklyStatsCard";
import ProductivityTrendChart from "./ProductivityTrendChart";
import WeeklyComparisonCard from "./WeeklyComparisonCard";
import ProductivityInsightsCard from "./ProductivityInsightsCard";
import { useAccount } from "@/components/AccountContext";

interface WeeklySummaryData {
  commits: { current: number; previous: number };
  prs: {
    thisWeek: { opened: number; merged: number };
    lastWeek: { opened: number; merged: number };
  };
  issues: { thisWeek: number; lastWeek: number };
  streak: number;
  topRepo: string | null;
  reposContributedCount: number;
  mostActiveDay: string;
  peakContributionPeriod: string;
  dailyContributions: Array<{ day: string; commits: number }>;
}

export default function WeeklyProductivitySummary() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const url =
      selectedAccount !== null
        ? `/api/metrics/weekly-summary?accountId=${encodeURIComponent(selectedAccount)}`
        : "/api/metrics/weekly-summary";

    fetch(url)
      .then(async (r) => {
        const body = await r.json();
        if (body?.error === "token_expired") throw new Error("Token expired");
        if (!r.ok) throw new Error("API error");
        return body as WeeklySummaryData;
      })
      .then((data) => {
        setData(data);
      })
      .catch(() => {
        setError("Failed to load weekly summary.");
      })
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse mb-12">
        <div className="h-8 w-64 bg-[var(--card-muted)] rounded"></div>
        <div className="h-24 w-full bg-[var(--card-muted)] rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 bg-[var(--card-muted)] rounded-xl"></div>
          <div className="flex flex-col gap-6">
            <div className="h-32 bg-[var(--card-muted)] rounded-xl"></div>
            <div className="h-32 bg-[var(--card-muted)] rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)] mb-12">
        {error || "No data available."}
      </div>
    );
  }

  return (
    <section className="mt-14 mb-12 space-y-6 scroll-mt-28" id="weekly-productivity">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="h-8 w-1.5 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
        <h2 className="text-2xl font-bold tracking-tight">Weekly Productivity Summary</h2>
      </div>

      <WeeklyStatsCard
        commits={data.commits.current}
        prs={data.prs.thisWeek.opened}
        issues={data.issues.thisWeek}
        repos={data.reposContributedCount}
        streak={data.streak}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--card-foreground)]">Productivity Trend</h3>
          <ProductivityTrendChart data={data.dailyContributions} />
        </div>
        <div className="flex flex-col gap-6">
          <WeeklyComparisonCard
            commits={{ current: data.commits.current, previous: data.commits.previous }}
            prs={{ current: data.prs.thisWeek.opened, previous: data.prs.lastWeek.opened }}
            issues={{ current: data.issues.thisWeek, previous: data.issues.lastWeek }}
          />
          <ProductivityInsightsCard
            mostActiveDay={data.mostActiveDay}
            mostActiveRepo={data.topRepo}
            peakPeriod={data.peakContributionPeriod}
          />
        </div>
      </div>
    </section>
  );
}
