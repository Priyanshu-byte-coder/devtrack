export type AchievementCategory = "commits" | "pull_requests" | "streak" | "repositories";
export type AchievementTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  requirement: number;
  iconName: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Commits
  { id: "commits_1", title: "First Commit", description: "Make your first commit.", category: "commits", tier: "Bronze", requirement: 1, iconName: "GitCommit" },
  { id: "commits_10", title: "Getting Started", description: "Reach 10 commits.", category: "commits", tier: "Bronze", requirement: 10, iconName: "GitCommit" },
  { id: "commits_100", title: "Centurion", description: "Reach 100 commits.", category: "commits", tier: "Silver", requirement: 100, iconName: "GitCommit" },
  { id: "commits_500", title: "Prolific Coder", description: "Reach 500 commits.", category: "commits", tier: "Gold", requirement: 500, iconName: "GitCommit" },
  { id: "commits_1000", title: "Commit Machine", description: "Reach 1000 commits.", category: "commits", tier: "Platinum", requirement: 1000, iconName: "GitCommit" },

  // Pull Requests
  { id: "prs_1", title: "First Pull Request", description: "Open your first pull request.", category: "pull_requests", tier: "Bronze", requirement: 1, iconName: "GitPullRequest" },
  { id: "prs_10", title: "Collaborator", description: "Open 10 pull requests.", category: "pull_requests", tier: "Silver", requirement: 10, iconName: "GitPullRequest" },
  { id: "prs_50", title: "Team Player", description: "Open 50 pull requests.", category: "pull_requests", tier: "Gold", requirement: 50, iconName: "GitPullRequest" },
  { id: "prs_100", title: "Open Source Hero", description: "Open 100 pull requests.", category: "pull_requests", tier: "Platinum", requirement: 100, iconName: "GitPullRequest" },

  // Streaks
  { id: "streak_7", title: "Weekly Warrior", description: "Maintain a 7-day contribution streak.", category: "streak", tier: "Bronze", requirement: 7, iconName: "Flame" },
  { id: "streak_30", title: "Monthly Master", description: "Maintain a 30-day contribution streak.", category: "streak", tier: "Silver", requirement: 30, iconName: "Flame" },
  { id: "streak_100", title: "Century Streak", description: "Maintain a 100-day contribution streak.", category: "streak", tier: "Gold", requirement: 100, iconName: "Flame" },
  { id: "streak_365", title: "Year Round", description: "Maintain a 365-day contribution streak.", category: "streak", tier: "Platinum", requirement: 365, iconName: "Flame" },

  // Repositories
  { id: "repos_1", title: "First Repository", description: "Contribute to your first repository.", category: "repositories", tier: "Bronze", requirement: 1, iconName: "BookMarked" },
  { id: "repos_5", title: "Explorer", description: "Contribute to 5 different repositories.", category: "repositories", tier: "Silver", requirement: 5, iconName: "BookMarked" },
  { id: "repos_25", title: "Wanderer", description: "Contribute to 25 different repositories.", category: "repositories", tier: "Gold", requirement: 25, iconName: "BookMarked" },
];
