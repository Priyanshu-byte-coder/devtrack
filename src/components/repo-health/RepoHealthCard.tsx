"use client";

import { memo } from "react";
import type { RepoHealthScore } from "@/types/repo-health";
import { gradeLetter, gradeLabel } from "@/lib/repo-health-insights";

interface Props {
  health: RepoHealthScore;
  isSelected: boolean;
  onClick: () => void;
}

const GRADE_BADGE: Record<string, string> = {
  green:
    "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/25",
  yellow: "bg-[#ca8a04]/15 text-[#ca8a04] border-[#ca8a04]/25",
  red: "bg-[var(--destructive)]/15 text-[var(--destructive)] border-[var(--destructive)]/25",
};

const GRADE_RING: Record<string, string> = {
  green: "ring-[var(--accent)]",
  yellow: "ring-[#ca8a04]",
  red: "ring-[var(--destructive)]",
};

/**
 * Compact repo card used in the explorer's left-panel repo list.
 *
 * Displays the repository name, letter grade, numeric score, and a small
 * progress bar.  Clicking selects the repo and shows the detailed breakdown.
 */
function RepoHealthCard({ health, isSelected, onClick }: Props) {
  const shortName = health.repo.split("/")[1] ?? health.repo;
  const letter = gradeLetter(health.score);
  const label = gradeLabel(health.grade);
  const badgeClass = GRADE_BADGE[health.grade] ?? GRADE_BADGE.red;
  const ringClass = GRADE_RING[health.grade] ?? GRADE_RING.red;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-xl border p-3 text-left transition-all duration-150",
        "hover:shadow-sm hover:-translate-y-px active:scale-[0.99]",
        isSelected
          ? `border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ${ringClass}`
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/40",
      ].join(" ")}
      aria-pressed={isSelected}
      aria-label={`Select ${health.repo} — health score ${health.score}, ${label}`}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Repo name */}
        <span className="truncate text-sm font-medium text-[var(--card-foreground)]">
          {shortName}
        </span>

        {/* Grade badge */}
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-bold ${badgeClass}`}
          aria-hidden="true"
        >
          {letter}
        </span>
      </div>

      {/* Owner and numeric score */}
      <div className="mt-1 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
        <span className="truncate">{health.repo.split("/")[0] ?? ""}</span>
        <span className="tabular-nums">{health.score} pts</span>
      </div>

      {/* Mini score bar */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${health.score}%`,
            backgroundColor:
              health.grade === "green"
                ? "var(--accent)"
                : health.grade === "yellow"
                  ? "#ca8a04"
                  : "var(--destructive)",
          }}
        />
      </div>
    </button>
  );
}

export default memo(RepoHealthCard);
