export interface ExplorerRepoCardData {
  id: string;
  name: string;
  fullName: string;
  commitCount: number;
  createdAt: string;
  updatedAt: string;
  primaryLanguage?: string;
  htmlUrl?: string;
  activity7d?: { day: string; commits: number }[];
}

export interface RepoContributorData {
  login: string;
  avatarUrl: string;
  contributions: number;
}

export interface HeatmapPoint {
  date: string;
  count: number;
}

export interface RepoHealth {
  score: number;
  signals: any;
  grade: string;
}

export interface LanguageSlice {
  name: string;
  percentage: number;
  color: string;
}

export interface TimelinePoint {
  date: string;
  events: number;
}

export interface RepoAnalyticsResponse {
  overview: {
    description: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    watchers: number;
    license: string;
    defaultBranch: string;
    createdAt: string;
    updatedAt: string;
  };
  contributors: RepoContributorData[];
  timeline: { date: string; events: number }[];
  health: RepoHealth;
  primaryStack: string[];
  languageBreakdown: LanguageSlice[];
  prActivity?: { total: number };

  /** true when GitHub responded 202 — stats are still being computed */
  statsBuilding?: boolean;
}
