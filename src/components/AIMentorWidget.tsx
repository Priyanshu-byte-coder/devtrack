"use client";

import React, { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { Sparkles } from "lucide-react";

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: "positive" | "neutral" | "warning";
}

interface AIData {
  insights: Insight[];
  trend: { direction: "up" | "down"; percentage: number };
  aiSummary: string | null;
  generatedAt: string;
}

const severityClasses: Record<Insight["severity"], string> = {
  positive:
    "bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]",
  neutral:
    "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent-foreground)]",
  warning:
    "bg-[var(--destructive)]/10 border-[var(--destructive)]/30 text-[var(--destructive)]",
};

const severityIcon: Record<Insight["severity"], string> = {
  positive: "✦",
  neutral: "◈",
  warning: "⚠",
};

function SkeletonCard() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm animate-pulse transition-all duration-300 hover:shadow-md hover:-translate-y-1"
    >
      <span className="sr-only">Loading AI Mentor insights</span>
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-[var(--card-muted)]" />
          <div className="h-3 w-40 rounded bg-[var(--card-muted)]" />
        </div>
        <div className="h-3 w-16 rounded bg-[var(--card-muted)]" />
      </div>
      <div className="rounded-lg h-20 bg-[var(--card-muted)] mb-4" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-lg h-14 bg-[var(--card-muted)] mb-2"
        />
      ))}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${severityClasses[insight.severity]}`}
    >
      <p className="font-medium">
        <span aria-hidden="true" className="mr-1.5">
          {severityIcon[insight.severity]}
        </span>
        {insight.title}
      </p>
      <p className="mt-1 text-xs opacity-80 leading-relaxed">
        {insight.description}
      </p>
    </div>
  );
}

export function AIMentorWidget() {
  const [data, setData] = useState<AIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/ai-insights?type=weekly_summary", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((json: { data: AIData }) => setData(json.data))
      .catch(() =>
        setError("AI insights are unavailable right now. Please try again later.")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonCard />;

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <div className="flex h-[200px] flex-col items-center justify-center text-center">
          <Sparkles
            className="mb-3 h-8 w-8 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--muted-foreground)]">
            No metrics available yet.
          </p>
        </div>
      </div>
    );
  }

  const formattedDate = mounted
    ? new Date(data.generatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)] flex items-center gap-2">
            <span aria-hidden="true" className="text-purple-500">
              ✦
            </span>
            AI Mentor
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Activity trend:{" "}
            <span
              className={
                data.trend.direction === "up"
                  ? "text-[var(--success)] font-medium"
                  : "text-[var(--destructive)] font-medium"
              }
            >
              {data.trend.direction === "up" ? "↑" : "↓"}&nbsp;
              {data.trend.percentage}%
            </span>{" "}
            vs prior period
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted-foreground)]">
            {formattedDate}
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed((v) => !v)}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand AI Mentor" : "Collapse AI Mentor"}
          >
            {isCollapsed ? "›" : "‹"}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-4 space-y-3">
          {data.aiSummary && (
            <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-4">
              <p className="text-xs font-semibold text-purple-400 mb-1.5 uppercase tracking-wide">
                Weekly summary · AI
              </p>
              <p 
                className="text-sm text-[var(--card-foreground)] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: mounted && typeof window !== "undefined" ? DOMPurify.sanitize(data.aiSummary) : ""
                }}
              />
            </div>
          )}

          {data.insights.length > 0 ? (
            data.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))
          ) : !data.aiSummary ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Keep coding — insights appear once you have more activity data.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
