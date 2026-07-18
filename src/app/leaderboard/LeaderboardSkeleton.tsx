import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 8;

export default function LeaderboardSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-[72px_1fr_110px_110px] border-b border-[var(--border)] bg-[var(--control)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] md:grid-cols-[80px_1fr_140px_140px_120px]">
        <div>Rank</div>
        <div>Contributor</div>
        <div>
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="hidden md:block">Score</div>
        <div>Profile</div>
      </div>

      {Array.from({ length: ROWS }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[72px_1fr_110px_110px] items-center border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[80px_1fr_140px_140px_120px]"
        >
          <Skeleton className="h-6 w-8" />

          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28 max-w-[120px] sm:max-w-[180px] md:max-w-none" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>

          <div className="hidden md:block">
            <Skeleton className="h-4 w-12" />
          </div>

          <div>
            <Skeleton className="h-9 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </section>
  );
}