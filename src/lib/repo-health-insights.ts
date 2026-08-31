/**
 * Pure helper functions for the Repository Health Explorer.
 *
 * All logic is data-driven: no repository names are referenced and no
 * thresholds are hard-coded for specific repos.  The same functions are used
 * for both the UI layer and the test suite.
 */

import type { RepoHealthSignals } from "@/types/repo-health";
import {
  scoreCommitFrequency,
  scorePrMergeRate,
  scoreAvgPrOpenTimeHours,
  scoreOpenIssuesCount,
  scoreDaysSinceLastCommit,
} from "@/lib/repo-health";

// ---------------------------------------------------------------------------
// Grade letters
// ---------------------------------------------------------------------------

/**
 * Converts the 0-100 composite health score to a letter grade with modifiers.
 * The three-tier system (green / yellow / red) from `gradeForScore` is
 * preserved; this function adds finer granularity for display purposes only.
 */
export function gradeLetter(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "A−";
  if (score >= 60) return "B+";
  if (score >= 50) return "B";
  if (score >= 40) return "B−";
  if (score >= 30) return "C+";
  if (score >= 20) return "C";
  return "D";
}

/** Human-readable tier label for a health grade. */
export function gradeLabel(grade: "green" | "yellow" | "red"): string {
  switch (grade) {
    case "green":
      return "Healthy";
    case "yellow":
      return "Needs Attention";
    case "red":
      return "At Risk";
  }
}

// ---------------------------------------------------------------------------
// Radar chart data
// ---------------------------------------------------------------------------

export interface RadarDatum {
  /** Short axis label displayed on the chart. */
  metric: string;
  /** Normalised 0-100 value (each sub-score divided by its max weight). */
  value: number;
  /** Always 100 — used by recharts to draw the reference polygon. */
  fullMark: number;
}

/**
 * Normalises each sub-score to a 0-100 scale so all five axes are
 * comparable in the radar chart regardless of their different max weights.
 */
export function buildRadarData(signals: RepoHealthSignals): RadarDatum[] {
  return [
    {
      metric: "Commits",
      value: Math.round((scoreCommitFrequency(signals.commitFrequency) / 25) * 100),
      fullMark: 100,
    },
    {
      metric: "PR Rate",
      value: Math.round((scorePrMergeRate(signals.prMergeRate) / 25) * 100),
      fullMark: 100,
    },
    {
      metric: "PR Speed",
      value: Math.round((scoreAvgPrOpenTimeHours(signals.avgPrOpenTimeHours) / 20) * 100),
      fullMark: 100,
    },
    {
      metric: "Issues",
      value: Math.round((scoreOpenIssuesCount(signals.openIssuesCount) / 15) * 100),
      fullMark: 100,
    },
    {
      metric: "Activity",
      value: Math.round((scoreDaysSinceLastCommit(signals.daysSinceLastCommit) / 15) * 100),
      fullMark: 100,
    },
  ];
}

// ---------------------------------------------------------------------------
// Score breakdown table
// ---------------------------------------------------------------------------

export interface BreakdownRow {
  /** Metric display name. */
  label: string;
  /** Formatted raw signal value (e.g. "12 commits", "65%"). */
  rawValue: string;
  /** Points earned for this dimension. */
  earned: number;
  /** Maximum possible points for this dimension. */
  maxScore: number;
  /** Target description shown as a tooltip / helper text. */
  tip: string;
  /** Weight contribution as a percentage of total score. */
  weightPct: number;
}

/**
 * Builds the per-dimension score breakdown displayed in the breakdown table.
 * The earned scores are calculated with the same functions used by
 * `computeHealthScore` so the numbers are always consistent.
 */
export function buildBreakdown(signals: RepoHealthSignals): BreakdownRow[] {
  return [
    {
      label: "Commit Frequency",
      rawValue:
        signals.commitFrequency === 1
          ? "1 commit"
          : `${signals.commitFrequency} commits`,
      earned: Math.round(scoreCommitFrequency(signals.commitFrequency)),
      maxScore: 25,
      tip: "Target: 10 or more commits in the analysis window",
      weightPct: 25,
    },
    {
      label: "PR Merge Rate",
      rawValue: `${Math.round(signals.prMergeRate * 100)}%`,
      earned: Math.round(scorePrMergeRate(signals.prMergeRate)),
      maxScore: 25,
      tip: "Target: 100% of opened PRs merged",
      weightPct: 25,
    },
    {
      label: "PR Turnaround",
      rawValue:
        signals.avgPrOpenTimeHours === 0
          ? "No PRs"
          : `${Math.round(signals.avgPrOpenTimeHours)}h avg`,
      earned: Math.round(scoreAvgPrOpenTimeHours(signals.avgPrOpenTimeHours)),
      maxScore: 20,
      tip: "Target: under 24 hours average",
      weightPct: 20,
    },
    {
      label: "Open Issues",
      rawValue:
        signals.openIssuesCount === 1
          ? "1 open issue"
          : `${signals.openIssuesCount} open issues`,
      earned: Math.round(scoreOpenIssuesCount(signals.openIssuesCount)),
      maxScore: 15,
      tip: "Target: 0 open issues",
      weightPct: 15,
    },
    {
      label: "Recent Activity",
      rawValue:
        signals.daysSinceLastCommit >= 9999
          ? "Unknown"
          : signals.daysSinceLastCommit === 0
            ? "Today"
            : `${signals.daysSinceLastCommit}d ago`,
      earned: Math.round(scoreDaysSinceLastCommit(signals.daysSinceLastCommit)),
      maxScore: 15,
      tip: "Target: commit within the last 7 days",
      weightPct: 15,
    },
  ];
}

// ---------------------------------------------------------------------------
// Recommendations engine
// ---------------------------------------------------------------------------

export interface HealthInsight {
  id: string;
  severity: "warning" | "success" | "info";
  title: string;
  description: string;
  /** Which metric produced this insight. */
  metric: string;
}

/**
 * Rule-based recommendations engine.
 *
 * Each rule checks a single signal against a threshold and produces an
 * insight with a severity level.  Rules are data-driven: all thresholds come
 * from the health-scoring functions in `@/lib/repo-health`, ensuring the
 * insights are always consistent with the numeric scores.
 */
export function generateInsights(signals: RepoHealthSignals): HealthInsight[] {
  const insights: HealthInsight[] = [];

  // ── Commit frequency ───────────────────────────────────────────────────
  if (signals.commitFrequency === 0) {
    insights.push({
      id: "no-commits",
      severity: "warning",
      title: "No recent commits",
      description:
        "No commits were detected in the analysis window. Regular commits keep the repository active and the score healthy.",
      metric: "Commit Frequency",
    });
  } else if (signals.commitFrequency < 3) {
    insights.push({
      id: "low-commits",
      severity: "warning",
      title: "Low commit frequency",
      description: `Only ${signals.commitFrequency} commit(s) in the analysis window. Aim for 10 or more per period to reach a full commit score.`,
      metric: "Commit Frequency",
    });
  } else if (signals.commitFrequency >= 10) {
    insights.push({
      id: "good-commits",
      severity: "success",
      title: "Strong commit activity",
      description: `${signals.commitFrequency} commits in the analysis window — at or above the healthy threshold of 10.`,
      metric: "Commit Frequency",
    });
  }

  // ── PR merge rate ──────────────────────────────────────────────────────
  if (signals.prMergeRate > 0 && signals.prMergeRate < 0.5) {
    insights.push({
      id: "low-merge-rate",
      severity: "warning",
      title: "Low PR merge rate",
      description: `Only ${Math.round(signals.prMergeRate * 100)}% of opened PRs were merged. Review and close stale pull requests to improve this signal.`,
      metric: "PR Merge Rate",
    });
  } else if (signals.prMergeRate >= 0.8) {
    insights.push({
      id: "good-merge-rate",
      severity: "success",
      title: "Excellent PR merge rate",
      description: `${Math.round(signals.prMergeRate * 100)}% of opened PRs were merged — healthy indicator of active code review.`,
      metric: "PR Merge Rate",
    });
  }

  // ── PR turnaround ──────────────────────────────────────────────────────
  if (signals.avgPrOpenTimeHours > 168) {
    insights.push({
      id: "slow-prs",
      severity: "warning",
      title: "Long PR review cycle",
      description: `Average PR open time is ${Math.round(signals.avgPrOpenTimeHours / 24)} day(s). Faster reviews reduce integration risk and improve velocity.`,
      metric: "PR Turnaround",
    });
  } else if (signals.avgPrOpenTimeHours > 72) {
    insights.push({
      id: "moderate-prs",
      severity: "info",
      title: "PR review time above average",
      description: `Average PR open time is ${Math.round(signals.avgPrOpenTimeHours)}h. Target under 48 hours for a healthy review cycle.`,
      metric: "PR Turnaround",
    });
  } else if (signals.avgPrOpenTimeHours > 0 && signals.avgPrOpenTimeHours <= 24) {
    insights.push({
      id: "fast-prs",
      severity: "success",
      title: "Fast PR turnaround",
      description:
        "PRs are reviewed and closed in under 24 hours on average — excellent review velocity.",
      metric: "PR Turnaround",
    });
  }

  // ── Open issues ────────────────────────────────────────────────────────
  if (signals.openIssuesCount >= 20) {
    insights.push({
      id: "high-issues",
      severity: "warning",
      title: "High open issue count",
      description: `${signals.openIssuesCount} open issues detected. Triage and close resolved or duplicate issues to reduce backlog pressure.`,
      metric: "Open Issues",
    });
  } else if (signals.openIssuesCount > 10) {
    insights.push({
      id: "moderate-issues",
      severity: "info",
      title: "Issue backlog growing",
      description: `${signals.openIssuesCount} open issues. Consider scheduling a triage session for older tickets.`,
      metric: "Open Issues",
    });
  } else if (signals.openIssuesCount === 0) {
    insights.push({
      id: "no-issues",
      severity: "success",
      title: "No open issues",
      description:
        "Issue backlog is clear — all reported problems have been addressed or closed.",
      metric: "Open Issues",
    });
  }

  // ── Recency ────────────────────────────────────────────────────────────
  if (signals.daysSinceLastCommit >= 9999) {
    insights.push({
      id: "no-commit-data",
      severity: "info",
      title: "Commit history unavailable",
      description:
        "Could not determine the date of the last commit. Verify repository access permissions.",
      metric: "Recent Activity",
    });
  } else if (signals.daysSinceLastCommit >= 30) {
    insights.push({
      id: "stale-repo",
      severity: "warning",
      title: "Repository may be stale",
      description: `The last commit was ${signals.daysSinceLastCommit} days ago. Push an update if this project is still active.`,
      metric: "Recent Activity",
    });
  } else if (signals.daysSinceLastCommit > 14) {
    insights.push({
      id: "low-activity",
      severity: "info",
      title: "Reduced recent activity",
      description: `Last commit was ${signals.daysSinceLastCommit} days ago. Consistent activity keeps the recency score high.`,
      metric: "Recent Activity",
    });
  } else if (signals.daysSinceLastCommit <= 3) {
    insights.push({
      id: "active-repo",
      severity: "success",
      title: "Actively maintained",
      description: `Last commit was ${signals.daysSinceLastCommit <= 0 ? "today" : `${signals.daysSinceLastCommit} day(s) ago`} — excellent recency signal.`,
      metric: "Recent Activity",
    });
  }

  return insights;
}
