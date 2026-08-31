/**
 * Type definitions for the AI-Powered Contribution Intelligence
 * & Resume/CV Generator feature.
 */

/* ------------------------------------------------------------------ */
/*  Engineering Domains                                                */
/* ------------------------------------------------------------------ */

export type EngineeringDomain =
  | "Frontend"
  | "Backend"
  | "AI_ML"
  | "DevOps"
  | "DataScience"
  | "Security"
  | "Mobile"
  | "Systems"
  | "FullStack";

/* ------------------------------------------------------------------ */
/*  Target Job Roles                                                   */
/* ------------------------------------------------------------------ */

export type TargetRole =
  | "Machine Learning Engineer"
  | "Frontend Developer"
  | "Backend Developer"
  | "Full Stack Developer"
  | "DevOps Engineer"
  | "Data Analyst"
  | "Mobile Developer"
  | "Security Engineer"
  | string; // Allow custom roles

/* ------------------------------------------------------------------ */
/*  Raw GitHub Contribution Data                                       */
/* ------------------------------------------------------------------ */

export interface GitHubContributionData {
  user: {
    login: string;
    avatarUrl: string;
    bio: string | null;
  };
  repositories: RepositoryData[];
  contributionStats: ContributionStats;
  fetchedAt: string;
}

export interface RepositoryData {
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  isForked: boolean;
  languages: string[];
  topics: string[];
  pullRequests: PullRequestData[];
  commits: CommitData[];
}

export interface PullRequestData {
  title: string;
  body: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  labels: string[];
  state: "MERGED" | "OPEN" | "CLOSED";
  mergedAt: string | null;
  createdAt: string;
}

export interface CommitData {
  message: string;
  committedDate: string;
  additions: number;
  deletions: number;
}

export interface ContributionStats {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  totalPullRequestReviewContributions: number;
  totalContributions: number;
}

/* ------------------------------------------------------------------ */
/*  Contribution Classification                                        */
/* ------------------------------------------------------------------ */

export interface TechStack {
  languages: TechItem[];
  frameworks: TechItem[];
  tools: TechItem[];
}

export interface TechItem {
  name: string;
  confidence: "high" | "medium" | "low";
  source: "language" | "topic" | "file_path" | "pr_content" | "commit_message";
  occurrences: number;
}

export interface DomainScore {
  domain: EngineeringDomain;
  score: number; // 0-100
  evidence: string[];
}

export interface ContributionClassification {
  techStack: TechStack;
  domains: DomainScore[];
  primaryDomain: EngineeringDomain;
  repositoryAnalyses: RepositoryAnalysis[];
  contributionScores: ContributionScores;
  generatedAt: string;
}

export interface RepositoryAnalysis {
  name: string;
  nameWithOwner: string;
  url: string;
  description: string | null;
  detectedDomains: EngineeringDomain[];
  languages: string[];
  topics: string[];
  complexity: "low" | "medium" | "high";
  prsMerged: number;
  totalAdditions: number;
  totalDeletions: number;
  relevanceByRole: Record<string, number>; // role -> 0-100 score
}

export interface ContributionScores {
  totalPRsMerged: number;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  totalReposContributed: number;
  totalIssues: number;
  totalReviews: number;
  avgPRSize: number;
  topLanguages: string[];
}

/* ------------------------------------------------------------------ */
/*  Resume / CV Content                                                */
/* ------------------------------------------------------------------ */

export interface ResumeContent {
  role: TargetRole;
  professionalSummary: string;
  bulletPoints: ResumeBulletPoint[];
  projectDescriptions: ProjectDescription[];
  skillSummary: string;
  skills: SkillCategory[];
  generatedAt: string;
}

export interface ResumeBulletPoint {
  text: string;
  repository: string;
  confidence: number; // 0-100
  technologies: string[];
}

export interface ProjectDescription {
  name: string;
  nameWithOwner: string;
  url: string;
  description: string;
  highlights: string[];
  technologies: string[];
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

/* ------------------------------------------------------------------ */
/*  Export Formats                                                      */
/* ------------------------------------------------------------------ */

export type ExportFormat = "pdf" | "markdown" | "json";

/* ------------------------------------------------------------------ */
/*  API Request / Response Types                                       */
/* ------------------------------------------------------------------ */

export interface CVAnalyzeResponse {
  analysis: ContributionClassification;
  cached: boolean;
}

export interface CVGenerateRequest {
  role: TargetRole;
}

export interface CVGenerateResponse {
  content: ResumeContent;
  cached: boolean;
}

export interface CVExportRequest {
  format: ExportFormat;
  content: ResumeContent;
}

/* ------------------------------------------------------------------ */
/*  UI State Types                                                     */
/* ------------------------------------------------------------------ */

export type CVFlowStep = "idle" | "analyzing" | "analyzed" | "generating" | "generated" | "exporting";

export interface CVPageState {
  step: CVFlowStep;
  analysis: ContributionClassification | null;
  selectedRole: TargetRole | null;
  resumeContent: ResumeContent | null;
  error: string | null;
}
