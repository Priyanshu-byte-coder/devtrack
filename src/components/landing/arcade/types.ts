import type { Tier } from "@/lib/gamification/scoring";

export type RepoStats = {
  stars: number;
  forks: number;
  openIssues: number;
  contributorCount: number;
  goodFirstIssues: number;
  contributors: Array<{
    login: string;
    avatar_url: string;
    html_url: string;
    isSponsor?: boolean;
  }>;
  totalCommits: number;
  mergedPRs: number;
};

/** One row of the landing page's hi-score table. */
export interface LandingLeader {
  username: string;
  scoreV2: number;
  tier: Tier;
  streak: number;
}

export const SIGN_IN_HREF = "/api/auth/signin/github?callbackUrl=/dashboard";
export const REPO_URL = "https://github.com/Priyanshu-byte-coder/devtrack";
