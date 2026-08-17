export type BadgeCategory = "streak" | "pull-request" | "goal" | "special";

export interface BadgeConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  threshold?: number;
  category: BadgeCategory;
  unlockCondition: string;
}

export const ACHIEVEMENTS: BadgeConfig[] = [
  {
    id: "7-day-streak",
    name: "7-Day Streak",
    description: "Maintained a coding streak for 7 consecutive days.",
    icon: "🔥",
    threshold: 7,
    category: "streak",
    unlockCondition: "streak.current >= 7",
  },
  {
    id: "10-prs-merged",
    name: "10 PRs Merged",
    description: "Merged 10 pull requests.",
    icon: "💻",
    threshold: 10,
    category: "pull-request",
    unlockCondition: "pullRequests >= 10",
  },
  {
    id: "50-prs-merged",
    name: "50 PRs Merged",
    description: "Merged 50 pull requests. Impressive!",
    icon: "🚀",
    threshold: 50,
    category: "pull-request",
    unlockCondition: "pullRequests >= 50",
  },
  {
    id: "first-goal",
    name: "First Goal Completed",
    description: "Completed your first goal on DevTrack.",
    icon: "🎯",
    threshold: 1,
    category: "goal",
    unlockCondition: "completedGoals >= 1",
  },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Merged a pull request before 8 AM.",
    icon: "🌅",
    category: "special",
    unlockCondition: "earlyBirdPRs >= 1",
  },
];
