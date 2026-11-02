import PageHeader from "@/components/shell/PageHeader";
import LeaderboardSkeleton from "@/app/leaderboard/LeaderboardSkeleton";

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Developers who made their profile public, ranked by streak, commits and pull requests."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-[var(--card-muted)]" />
        <div className="h-9 w-72 animate-pulse rounded-lg bg-[var(--card-muted)]" />
      </div>
      <LeaderboardSkeleton />
    </>
  );
}
