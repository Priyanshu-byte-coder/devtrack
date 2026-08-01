"use client";

import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAccount } from "@/components/AccountContext";
import WidgetSkeleton, { SkeletonBlock } from "./WidgetSkeleton";

interface PRBreakdown {
  draft: number;
  open: number;
  merged: number;
  closed: number;
}

const SLICES: { key: keyof PRBreakdown; label: string; color: string }[] = [
  { key: "open",   label: "Open",   color: "var(--accent)" },
  { key: "merged", label: "Merged", color: "var(--success)" },
  { key: "closed", label: "Closed", color: "var(--warning)" },
  { key: "draft",  label: "Draft",  color: "var(--muted-foreground)" },
];

export default function PRBreakdownChart() {
  const { selectedAccount } = useAccount();
  const [breakdown, setBreakdown] = useState<PRBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCSSVariable = (varName: string): string => {
    if (typeof window === "undefined") return "#000";
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
  };

  const fetchBreakdown = useCallback(() => {
    setLoading(true);
    setError(null);

    const url = selectedAccount !== null
      ? `/api/metrics/pr-breakdown?accountId=${encodeURIComponent(selectedAccount)}`
      : "/api/metrics/pr-breakdown";

    fetch(url)
      .then((r) => r.json())
      .then((d: PRBreakdown) => setBreakdown(d))
      .catch(() =>
        setError("We couldn't load your PR breakdown right now. Please try again in a moment.")
      )
      .finally(() => setLoading(false));
  }, [selectedAccount]);

  useEffect(() => {
    fetchBreakdown();
  }, [fetchBreakdown]);

  if (loading) {
    return (
      <WidgetSkeleton title="PR Breakdown">
        <SkeletonBlock className="h-[200px] w-full" />
      </WidgetSkeleton>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">PR Breakdown</h2>
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchBreakdown}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const total = breakdown ? SLICES.reduce((sum, s) => sum + (breakdown[s.key] ?? 0), 0) : 0;
  const chartData = breakdown
    ? SLICES.map((s) => ({ name: s.label, value: breakdown[s.key] ?? 0, color: s.color })).filter(
        (d) => d.value > 0
      )
    : [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">PR Breakdown</h2>
      {total === 0 ? (
        <p className="flex h-[200px] items-center justify-center text-sm text-[var(--muted-foreground)]">
          No pull requests found.
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
               <Tooltip
  contentStyle={{
    backgroundColor: getCSSVariable('--tooltip'),
    border: `1px solid ${getCSSVariable('--border')}`,
    borderRadius: "10px",
    color: getCSSVariable('--tooltip-foreground'),
  }}
  itemStyle={{
    color: getCSSVariable('--tooltip-foreground'),
  }}
  labelStyle={{
    color: getCSSVariable('--tooltip-foreground'),
  }}
/>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap justify-center gap-4">
            {SLICES.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}: {breakdown?.[s.key] ?? 0}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
