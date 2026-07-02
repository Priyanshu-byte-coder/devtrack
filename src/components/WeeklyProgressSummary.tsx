"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/components/AccountContext";
import SectionHeader from "./SectionHeader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Calendar, GitCommit, GitPullRequest, CircleDot, TrendingUp, TrendingDown, Award } from "lucide-react";

interface WeeklySummaryData {
  commits: {
    current: number;
    previous: number;
    delta: number;
    trend: "up" | "down" | "same";
  };
  prs: {
    thisWeek: { opened: number; merged: number };
    lastWeek: { opened: number; merged: number };
  };
  issues: {
    thisWeek: { opened: number; closed: number };
    lastWeek: { opened: number; closed: number };
  };
  activeDays: {
    thisWeek: number;
    lastWeek: number;
  };
  streak: number;
  topRepo: string | null;
  repoBreakdown: { repoName: string; commits: number }[];
  dailyCommits: { date: string; commits: number }[];
  mostActiveDay: string | null;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export default function WeeklyProgressSummary() {
  const { selectedAccount } = useAccount();
  const [data, setData] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchMetrics = useCallback(() => {
    setLoading(true);
    setError(null);
    const url = selectedAccount !== null
      ? `/api/metrics/weekly-summary?accountId=${encodeURIComponent(selectedAccount)}`
      : `/api/metrics/weekly-summary`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((data: WeeklySummaryData) => setData(data))
      .catch(() => setError("We couldn't load your weekly summary right now."))
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const exportToPDF = () => {
    if (!data) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const generatedAt = new Date().toLocaleString();
      
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Weekly Progress Summary", 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${generatedAt}`, 14, 28);
      
      doc.setTextColor(15, 23, 42);
      
      // Core Metrics Table
      autoTable(doc, {
        startY: 35,
        head: [["Metric", "This Week", "Last Week"]],
        body: [
          ["Commits", data.commits.current, data.commits.previous],
          ["PRs Opened", data.prs.thisWeek.opened, data.prs.lastWeek.opened],
          ["PRs Merged", data.prs.thisWeek.merged, data.prs.lastWeek.merged],
          ["Issues Opened", data.issues.thisWeek.opened, data.issues.lastWeek.opened],
          ["Issues Closed", data.issues.thisWeek.closed, data.issues.lastWeek.closed],
          ["Active Days", data.activeDays.thisWeek, data.activeDays.lastWeek],
        ],
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59] },
      });
      
      // Repo Breakdown Table
      const finalY = (doc as any).lastAutoTable.finalY || 35;
      if (data.repoBreakdown.length > 0) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Repository Breakdown", 14, finalY + 15);
        
        autoTable(doc, {
          startY: finalY + 20,
          head: [["Repository", "Commits"]],
          body: data.repoBreakdown.map(repo => [repo.repoName, repo.commits]),
          theme: "grid",
          headStyles: { fillColor: [30, 41, 59] },
        });
      }

      doc.save(`devtrack-weekly-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-[var(--card-muted)] rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[var(--card-muted)] rounded-lg" />)}
        </div>
        <div className="h-48 bg-[var(--card-muted)] rounded-lg mt-4" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        <p>{error || "Failed to load"}</p>
        <button onClick={fetchMetrics} className="mt-3 rounded-md px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 border border-red-500/30">
          Try again
        </button>
      </div>
    );
  }

  const chartData = data.dailyCommits.slice().reverse().map(d => ({
    name: formatDateLabel(d.date),
    commits: d.commits,
    fullDate: d.date,
  }));

  const improvedMetrics = data.commits.delta > 0 || 
    data.prs.thisWeek.merged > data.prs.lastWeek.merged || 
    data.activeDays.thisWeek > data.activeDays.lastWeek;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionHeader title="Weekly Progress Summary" />
        
        <button
          onClick={exportToPDF}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--control)] px-3 py-1.5 text-sm font-medium border border-[var(--border)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
        >
          {isExporting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Download PDF
        </button>
      </div>

      {improvedMetrics && (
        <div className="flex items-center gap-2 text-sm text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 rounded-lg border border-[var(--accent)]/20">
          <Award className="w-4 h-4" />
          <span>You have improved in some key metrics compared to last week. Keep it up!</span>
        </div>
      )}

      {/* Top Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Commits */}
        <div className="rounded-lg bg-[var(--control)] p-4 border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--muted-foreground)]">Commits</span>
            <GitCommit className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{data.commits.current}</div>
          <div className="flex items-center gap-1 mt-1 text-xs">
            {data.commits.trend === "up" ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : data.commits.trend === "down" ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : null}
            <span className={data.commits.trend === "up" ? "text-green-500" : data.commits.trend === "down" ? "text-red-500" : "text-[var(--muted-foreground)]"}>
              {data.commits.trend !== "same" ? `${Math.abs(data.commits.delta)} vs last week` : "Same as last week"}
            </span>
          </div>
        </div>

        {/* PRs */}
        <div className="rounded-lg bg-[var(--control)] p-4 border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--muted-foreground)]">Pull Requests</span>
            <GitPullRequest className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {data.prs.thisWeek.opened} <span className="text-lg text-[var(--muted-foreground)] font-normal">opened</span>
          </div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)] flex items-center justify-between">
            <span>{data.prs.thisWeek.merged} merged</span>
            <span>vs {data.prs.lastWeek.opened} / {data.prs.lastWeek.merged} last wk</span>
          </div>
        </div>

        {/* Issues */}
        <div className="rounded-lg bg-[var(--control)] p-4 border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--muted-foreground)]">Issues</span>
            <CircleDot className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {data.issues.thisWeek.opened} <span className="text-lg text-[var(--muted-foreground)] font-normal">opened</span>
          </div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)] flex items-center justify-between">
            <span>{data.issues.thisWeek.closed} closed</span>
            <span>vs {data.issues.lastWeek.opened} / {data.issues.lastWeek.closed} last wk</span>
          </div>
        </div>

        {/* Streaks & Activity */}
        <div className="rounded-lg bg-[var(--control)] p-4 border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--muted-foreground)]">Activity</span>
            <Calendar className="w-4 h-4 text-[var(--muted-foreground)]" />
          </div>
          <div className="text-lg font-bold text-[var(--foreground)]">
            {data.streak} day streak
          </div>
          <div className="mt-1 text-xs text-[var(--muted-foreground)] truncate">
            Most active: {data.mostActiveDay ? formatDateLabel(data.mostActiveDay) : "N/A"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 rounded-lg bg-[var(--control)] p-4 border border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-4">Weekly Contribution Trend</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: "bold", marginBottom: "4px" }}
                  itemStyle={{ color: "var(--accent)" }}
                  formatter={(value: number) => [value, "Commits"]}
                  labelFormatter={(label, payload) => payload[0]?.payload.fullDate || label}
                />
                <Line 
                  type="monotone" 
                  dataKey="commits" 
                  stroke="var(--accent)" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: "var(--card)", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--card)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Repo Breakdown */}
        <div className="rounded-lg bg-[var(--control)] p-4 border border-[var(--border)] overflow-hidden flex flex-col">
          <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-4">Repository Breakdown</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {data.repoBreakdown.length > 0 ? (
              data.repoBreakdown.slice(0, 5).map((repo) => {
                const percentage = Math.round((repo.commits / data.commits.current) * 100);
                return (
                  <div key={repo.repoName} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium truncate pr-2 text-[var(--foreground)]" title={repo.repoName}>
                        {repo.repoName.split("/").pop() || repo.repoName}
                      </span>
                      <span className="text-[var(--muted-foreground)] whitespace-nowrap">{repo.commits} ({percentage}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--card-muted)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent)] rounded-full" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-[var(--muted-foreground)] h-full flex items-center justify-center">
                No activity this week
              </div>
            )}
            {data.repoBreakdown.length > 5 && (
              <div className="text-xs text-center text-[var(--muted-foreground)] pt-2">
                + {data.repoBreakdown.length - 5} more repositories
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
