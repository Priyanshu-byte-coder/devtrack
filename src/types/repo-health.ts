export interface RepoHealthSignals {
  commitFrequency: number;
  prMergeRate: number;
  avgPrOpenTimeHours: number;
  openIssuesCount: number;
  daysSinceLastCommit: number;
  contributorCount: number;
  documentationScore: number; // 0-100
}

export interface RepoHealthScore {
  repo: string; // "owner/repo"
  score: number; // 0-100 composite
  signals: RepoHealthSignals;
  grade: "green" | "yellow" | "red"; // green 70+, yellow 40-69, red <40
}

export interface RepoHealthResponse {
  repos: RepoHealthScore[];
}
