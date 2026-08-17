import { calculatePercentageChange, formatPercentageChange } from "@/lib/weekly-summary-utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface WeeklyComparisonCardProps {
  commits: { current: number; previous: number };
  prs: { current: number; previous: number };
  issues: { current: number; previous: number };
}

export default function WeeklyComparisonCard({ commits, prs, issues }: WeeklyComparisonCardProps) {
  const commitChange = calculatePercentageChange(commits.current, commits.previous);
  const prChange = calculatePercentageChange(prs.current, prs.previous);
  const issueChange = calculatePercentageChange(issues.current, issues.previous);

  const renderTrend = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-[var(--success)]" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-[var(--destructive)]" />;
    return <Minus className="h-4 w-4 text-[var(--muted-foreground)]" />;
  };

  const getColorClass = (change: number) => {
    if (change > 0) return "text-[var(--success)]";
    if (change < 0) return "text-[var(--destructive)]";
    return "text-[var(--muted-foreground)]";
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--card-foreground)] mb-4">Weekly Comparison</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--muted-foreground)]">Commits</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${getColorClass(commitChange)}`}>{formatPercentageChange(commitChange)}</span>
            {renderTrend(commitChange)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--muted-foreground)]">Pull Requests</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${getColorClass(prChange)}`}>{formatPercentageChange(prChange)}</span>
            {renderTrend(prChange)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--muted-foreground)]">Issues</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${getColorClass(issueChange)}`}>{formatPercentageChange(issueChange)}</span>
            {renderTrend(issueChange)}
          </div>
        </div>
      </div>
    </div>
  );
}
