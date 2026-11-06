import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 8;

/** Mirrors the real row layout in `page.tsx`, including its `sm` breakpoint. */
export default function LeaderboardSkeleton() {
  return (
    <section className="px-frame bg-[var(--card)]">
      <div
        aria-hidden="true"
        className="hidden border-b border-[var(--border)] bg-[var(--control)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] sm:flex sm:items-center sm:gap-3"
      >
        <span className="w-10 shrink-0">Rank</span>
        <span className="w-10 shrink-0" />
        <span className="min-w-0 flex-1">Contributor</span>
        <span className="w-24 shrink-0 text-right">
          <Skeleton className="ml-auto h-3 w-12" />
        </span>
        <span className="hidden w-16 shrink-0 text-right md:block">Level</span>
        <span className="w-[4.5rem] shrink-0 text-right">Profile</span>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {Array.from({ length: ROWS }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-5 w-7 shrink-0 sm:w-10" />
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />

            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>

            <div className="hidden w-24 shrink-0 space-y-2 sm:block">
              <Skeleton className="ml-auto h-5 w-10" />
              <Skeleton className="ml-auto h-3 w-14" />
            </div>

            <Skeleton className="hidden h-4 w-12 shrink-0 md:block" />

            <Skeleton className="h-8 w-[4.5rem] shrink-0 rounded-lg" />
          </li>
        ))}
      </ul>
    </section>
  );
}
