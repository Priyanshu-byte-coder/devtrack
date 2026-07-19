"use client";

import { useEffect } from "react";
import type { RepoHealthScore } from "@/types/repo-health";
interface Props {
  health: RepoHealthScore;
  isOpen: boolean;
  onClose: () => void;
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = Math.round((score / maxScore) * 100);
  const color =
    pct >= 70
      ? "bg-[var(--accent)]"
      : pct >= 40
        ? "bg-[var(--warning)]"
        : "bg-[var(--destructive)]";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--control)]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function RepoHealthPanel({ health, isOpen, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  if (!isOpen) return null;
  const s = health.signals;
  const shortName = health.repo.split("/")[1] ?? health.repo;

  const commitScore = Math.min(20, Math.round((s.commitFrequency / 10) * 20));
  const prScore = Math.min(20, Math.round(s.prMergeRate * 25));
  const prTimeScore =
    s.avgPrOpenTimeHours === 0
      ? 20
      : Math.max(0, Math.round(20 - (s.avgPrOpenTimeHours / 168) * 20));
  const issueScore = Math.max(0, Math.round(20 - s.openIssuesCount * 2));
  const recencyScore = Math.max(
    0,
    Math.round(20 - (s.daysSinceLastCommit / 30) * 20)
  );

  const contributorScore = Math.min(
    20,
    Math.round((s.contributorCount / 10) * 20)
  );

  const docsScore = Math.round((s.documentationScore / 100) * 20);

  const dimensions = [
    {
      label: "Commit Activity",
      score: commitScore,
      tip:
        commitScore < 10
          ? "Aim for at least 10 commits per month."
          : "Good commit frequency!",
    },
    {
      label: "PR Merge Rate",
      score: prScore,
      tip:
        prScore < 10
          ? "Review and close stale pull requests."
          : "Healthy merge rate.",
    },
    {
      label: "PR Turnaround",
      score: prTimeScore,
      tip:
        prTimeScore < 10
          ? "Try to review and merge PRs faster."
          : "PRs are moving quickly.",
    },
    {
      label: "Issue Load",
      score: issueScore,
      tip:
        issueScore < 10
          ? "Triage and close outdated issues."
          : "Issue backlog looks manageable.",
    },
    {
      label: "Recent Activity",
      score: recencyScore,
      tip:
        recencyScore < 10
          ? `Last commit was ${s.daysSinceLastCommit} days ago.`
          : "Repo is actively maintained.",
    },
    {
      label: "Contributor Activity",
      score: contributorScore,
      tip:
        contributorScore < 10
          ? "Encourage more contributors."
          : "Healthy contributor activity.",
    },

    {
      label: "Documentation Quality",
      score: docsScore,
      tip:
        docsScore < 10
          ? "Improve README and documentation."
          : "Documentation looks good.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-panel-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2
              id="health-panel-title"
              className="text-base font-semibold text-[var(--card-foreground)]"
            >
              Health Breakdown
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {shortName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-bold ${health.grade === "green" ? "text-[var(--accent)]" : health.grade === "yellow" ? "text-[var(--warning,#ca8a04)]" : "text-[var(--destructive)]"}`}
            >
              {health.score}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--control)] transition-all hover:opacity-90 active:scale-95"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="space-y-4">
          {dimensions.map((dim) => (
            <div key={dim.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[var(--card-foreground)]">
                  {dim.label}
                </span>
                <span className="text-[var(--muted-foreground)] tabular-nums">
                  {dim.score}/20
                </span>
              </div>
              <ScoreBar score={dim.score} maxScore={20} />
              {dim.score < 20 && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {dim.tip}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted-foreground)]">
            Score based on activity in the last 30 days. Updates on page
            refresh.
          </p>
          <a
            href={`/dashboard/repo-health`}
            className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline underline-offset-2"
          >
            Full Analysis →
          </a>
        </div>
      </div>
    </div>
  );
}
