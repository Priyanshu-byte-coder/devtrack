import { CalendarDays, GitBranch, Clock } from "lucide-react";

interface ProductivityInsightsCardProps {
  mostActiveDay: string;
  mostActiveRepo: string | null;
  peakPeriod: string;
}

export default function ProductivityInsightsCard({ mostActiveDay, mostActiveRepo, peakPeriod }: ProductivityInsightsCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-[var(--card-foreground)] mb-4">Productivity Insights</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Most Active Day</p>
            <p className="text-sm font-semibold text-[var(--card-foreground)]">{mostActiveDay}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <GitBranch className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Most Active Repo</p>
            <p className="text-sm font-semibold text-[var(--card-foreground)] truncate" title={mostActiveRepo || "None"}>
              {mostActiveRepo || "None"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Peak Contribution</p>
            <p className="text-sm font-semibold text-[var(--card-foreground)]">{peakPeriod}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
