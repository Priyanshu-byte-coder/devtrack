"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { useAccount } from "@/components/AccountContext";
import type { RepoHealthScore } from "@/types/repo-health";
import {
  buildBreakdown,
  buildRadarData,
  generateInsights,
  gradeLetter,
  gradeLabel,
} from "@/lib/repo-health-insights";
import RepoHealthCard from "@/components/repo-health/RepoHealthCard";
import RepoHealthBreakdown from "@/components/repo-health/RepoHealthBreakdown";
import RepoHealthInsights from "@/components/repo-health/RepoHealthInsights";

// Lazy-load recharts-backed components so the charting bundle is only fetched
// when the explorer page is actually visited.
const RepoHealthGauge = dynamic(
  () => import("@/components/repo-health/RepoHealthGauge"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[110px] w-full max-w-[200px] items-center justify-center">
        <div className="h-20 w-32 animate-pulse rounded-t-full bg-[var(--border)]" />
      </div>
    ),
  }
);

const RepoHealthRadar = dynamic(
  () => import("@/components/repo-health/RepoHealthRadar"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[230px] w-full animate-pulse rounded-xl bg-[var(--card-muted)]" />
    ),
  }
);

// ---------------------------------------------------------------------------
// Grade styling
// ---------------------------------------------------------------------------

const GRADE_COLOR: Record<string, string> = {
  green: "text-[var(--accent)]",
  yellow: "text-[#ca8a04]",
  red: "text-[var(--destructive)]",
};

const GRADE_BG: Record<string, string> = {
  green: "border-[var(--accent)]/30 bg-[var(--accent)]/8",
  yellow: "border-[#ca8a04]/30 bg-[#ca8a04]/8",
  red: "border-[var(--destructive)]/30 bg-[var(--destructive)]/8",
};

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  health: RepoHealthScore;
}

const DetailPanel = memo(function DetailPanel({ health }: DetailPanelProps) {
  const letter = gradeLetter(health.score);
  const label = gradeLabel(health.grade);
  const shortName = health.repo.split("/")[1] ?? health.repo;
  const radarData = useMemo(() => buildRadarData(health.signals), [health]);
  const breakdown = useMemo(() => buildBreakdown(health.signals), [health]);
  const insights = useMemo(() => generateInsights(health.signals), [health]);
  const colorClass = GRADE_COLOR[health.grade] ?? GRADE_COLOR.red;
  const bgClass = GRADE_BG[health.grade] ?? GRADE_BG.red;

  return (
    <div className="space-y-5">
      {/* ── Header: repo name + GitHub link ────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--card-foreground)]">
            {shortName}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {health.repo}
          </p>
        </div>
        <a
          href={`https://github.com/${health.repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition hover:border-[var(--accent)]/50 hover:text-[var(--card-foreground)]"
          aria-label={`Open ${health.repo} on GitHub`}
        >
          <ExternalLink size={12} aria-hidden="true" />
          GitHub
        </a>
      </div>

      {/* ── Gauge + Grade card ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Gauge */}
        <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <RepoHealthGauge score={health.score} grade={health.grade} />
        </div>

        {/* Grade card */}
        <div
          className={`flex flex-col items-center justify-center rounded-xl border p-4 ${bgClass}`}
          aria-label={`Grade: ${letter}, ${label}`}
        >
          <span
            className={`text-5xl font-extrabold leading-none ${colorClass}`}
            aria-hidden="true"
          >
            {letter}
          </span>
          <span
            className={`mt-2 text-xs font-semibold uppercase tracking-wide ${colorClass}`}
          >
            {label}
          </span>
          <span className="mt-1 text-xs text-[var(--muted-foreground)]">
            Score: {health.score}/100
          </span>
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${colorClass} bg-current/10`}
          >
            {health.grade}
          </span>
        </div>
      </div>

      {/* ── Radar chart ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        aria-label="Health score radar chart"
      >
        <h3 className="mb-2 text-sm font-semibold text-[var(--card-foreground)]">
          Dimension Overview
        </h3>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          Each axis is normalised to 0–100 for visual balance.
        </p>
        <RepoHealthRadar data={radarData} grade={health.grade} />
      </div>

      {/* ── Score breakdown ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <RepoHealthBreakdown rows={breakdown} />
      </div>

      {/* ── Recommendations ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <RepoHealthInsights insights={insights} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3 animate-pulse">
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-32 rounded bg-[var(--card-muted)]" />
        <div className="h-5 w-8 rounded-full bg-[var(--card-muted)]" />
      </div>
      <div className="mt-1 flex justify-between">
        <div className="h-3 w-20 rounded bg-[var(--card-muted)]" />
        <div className="h-3 w-12 rounded bg-[var(--card-muted)]" />
      </div>
      <div className="mt-2 h-1 rounded-full bg-[var(--card-muted)]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main explorer
// ---------------------------------------------------------------------------

export default function RepoHealthExplorer() {
  const { selectedAccount } = useAccount();
  const [healthScores, setHealthScores] = useState<RepoHealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const fetchScores = useCallback(() => {
    setLoading(true);
    setError(null);

    const accountParam =
      selectedAccount != null
        ? `&accountId=${encodeURIComponent(selectedAccount)}`
        : "";

    fetch(`/api/metrics/repo-health?days=${days}${accountParam}`)
      .then((r) => r.json())
      .then((d: { repos?: RepoHealthScore[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        const repos = (d.repos ?? []).sort((a, b) => b.score - a.score);
        setHealthScores(repos);
        // Auto-select the top-scoring repo on first load
        if (!selectedRepo && repos.length > 0) {
          setSelectedRepo(repos[0].repo);
        }
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error && err.message !== "GitHub API error"
            ? err.message
            : "Unable to load repository health data. Please try again."
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, selectedAccount]);

  // Persist selected days range across sessions
  useEffect(() => {
    const saved = localStorage.getItem("devtrack_health_range");
    if (saved && ["7", "30", "90"].includes(saved)) {
      setDays(Number(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("devtrack_health_range", String(days));
  }, [days]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const selectedHealth = useMemo(
    () => healthScores.find((h) => h.repo === selectedRepo) ?? null,
    [healthScores, selectedRepo]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--card-foreground)] hover:border-[var(--accent)]/40"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Dashboard
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Repository Health Explorer
            </h1>
            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">
              Interactive health breakdown for your most active repositories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="health-days-select" className="sr-only">
            Analysis window
          </label>
          <select
            id="health-days-select"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setSelectedRepo(null);
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-1.5 text-sm text-[var(--card-foreground)]"
            aria-label="Select analysis window"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSelectedRepo(null);
              fetchScores();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--card-foreground)] disabled:opacity-50"
            aria-label="Refresh health scores"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : ""}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4">
          <p className="text-sm text-[var(--destructive)]">{error}</p>
          <button
            type="button"
            onClick={fetchScores}
            className="mt-2 text-xs text-[var(--destructive)] underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* ── Left panel: repo list ──────────────────────────────────── */}
        <aside aria-label="Repository list" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
            Repositories
            {!loading && healthScores.length > 0 && (
              <span className="ml-1 text-[var(--card-foreground)]">
                ({healthScores.length})
              </span>
            )}
          </p>

          {loading ? (
            Array.from({ length: 5 }, (_, i) => <CardSkeleton key={i} />)
          ) : healthScores.length === 0 && !error ? (
            <div className="rounded-xl border border-[var(--border)] p-6 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">
                No repositories found for this period. Try a wider analysis
                window.
              </p>
            </div>
          ) : (
            healthScores.map((h) => (
              <RepoHealthCard
                key={h.repo}
                health={h}
                isSelected={selectedRepo === h.repo}
                onClick={() => setSelectedRepo(h.repo)}
              />
            ))
          )}
        </aside>

        {/* ── Right panel: detail view ───────────────────────────────── */}
        <main aria-label="Repository health detail">
          {loading ? (
            <div className="space-y-4">
              <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--card-muted)]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-36 animate-pulse rounded-xl bg-[var(--card-muted)]" />
                <div className="h-36 animate-pulse rounded-xl bg-[var(--card-muted)]" />
              </div>
              <div className="h-[230px] animate-pulse rounded-xl bg-[var(--card-muted)]" />
              <div className="h-48 animate-pulse rounded-xl bg-[var(--card-muted)]" />
              <div className="h-40 animate-pulse rounded-xl bg-[var(--card-muted)]" />
            </div>
          ) : selectedHealth ? (
            <DetailPanel health={selectedHealth} />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-center p-8">
              <div className="mb-3 text-3xl" aria-hidden="true">
                📊
              </div>
              <h2 className="text-sm font-semibold text-[var(--card-foreground)]">
                Select a repository
              </h2>
              <p className="mt-1 max-w-xs text-xs text-[var(--muted-foreground)]">
                Choose a repository from the list on the left to see its full
                health breakdown and recommendations.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
