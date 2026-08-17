import { GitCommit, GitPullRequest, CheckCircle, BookOpen, Flame } from "lucide-react";

interface WeeklyStatsCardProps {
  commits: number;
  prs: number;
  issues: number;
  repos: number;
  streak: number;
}

export default function WeeklyStatsCard({ commits, prs, issues, repos, streak }: WeeklyStatsCardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-2 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <GitCommit className="h-4 w-4" />
          <span className="text-sm font-medium">Commits</span>
        </div>
        <span className="text-2xl font-bold text-[var(--card-foreground)]">{commits}</span>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-2 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <GitPullRequest className="h-4 w-4" />
          <span className="text-sm font-medium">PRs</span>
        </div>
        <span className="text-2xl font-bold text-[var(--card-foreground)]">{prs}</span>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-2 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Issues</span>
        </div>
        <span className="text-2xl font-bold text-[var(--card-foreground)]">{issues}</span>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-2 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <BookOpen className="h-4 w-4" />
          <span className="text-sm font-medium">Repos</span>
        </div>
        <span className="text-2xl font-bold text-[var(--card-foreground)]">{repos}</span>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-2 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium">Streak</span>
        </div>
        <span className="text-2xl font-bold text-[var(--card-foreground)]">{streak} days</span>
      </div>
    </div>
  );
}
