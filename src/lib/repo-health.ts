import type { RepoHealthScore, RepoHealthSignals } from "@/types/repo-health";

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) {
    return min;
  }

  return Math.min(max, Math.max(min, n));
}

export function scoreCommitFrequency(commits30d: number): number {
  // 10+ commits => full 25 points; linear below
  const normalized = clamp(commits30d / 10, 0, 1);
  return normalized * 25;
}

export function scorePrMergeRate(rate: number): number {
  // rate is already 0-1
  return clamp(rate, 0, 1) * 25;
}

export function scoreAvgPrOpenTimeHours(avgHours: number): number {
  // <24h => full 20; 24-168h scales down linearly; >168h => 0
  if (avgHours <= 24) return 20;
  if (avgHours >= 168) return 0;
  const normalized = 1 - (avgHours - 24) / (168 - 24);
  return clamp(normalized, 0, 1) * 20;
}

export function scoreOpenIssuesCount(openIssues: number): number {
  // 0 issues => full 15; 20+ => 0; linear in between
  if (openIssues <= 0) return 15;
  if (openIssues >= 20) return 0;
  const normalized = 1 - openIssues / 20;
  return clamp(normalized, 0, 1) * 15;
}

export function scoreDaysSinceLastCommit(days: number): number {
  // <7 days => full 15; 7-30 => scale down linearly; >30 => 0
  if (days <= 7) return 15;
  if (days >= 30) return 0;
  const normalized = 1 - (days - 7) / (30 - 7);
  return clamp(normalized, 0, 1) * 15;
}

export function scoreContributorActivity(contributors: number): number {
  // 10+ contributors => full 10 points
  return clamp(contributors / 10, 0, 1) * 10;
}

export function scoreDocumentationQuality(docScore: number): number {
  // documentationScore already ranges from 0-100
  return clamp(docScore / 100, 0, 1) * 10;
}
export function gradeForScore(score: number): RepoHealthScore["grade"] {
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

export function computeHealthScore(
  repo: string,
  signals: RepoHealthSignals
): RepoHealthScore {
  const score =
    scoreCommitFrequency(signals.commitFrequency) * 0.8 +
    scorePrMergeRate(signals.prMergeRate) * 0.8 +
    scoreAvgPrOpenTimeHours(signals.avgPrOpenTimeHours) * 0.8 +
    scoreOpenIssuesCount(signals.openIssuesCount) * 0.8 +
    scoreDaysSinceLastCommit(signals.daysSinceLastCommit) * 0.8 +
    scoreContributorActivity(signals.contributorCount) +
    scoreDocumentationQuality(signals.documentationScore);
    
  const rounded = Math.round(score);
  const clampedScore = clamp(rounded, 0, 100);

  return {
    repo,
    score: clampedScore,
    signals,
    grade: gradeForScore(clampedScore),
  };
}
