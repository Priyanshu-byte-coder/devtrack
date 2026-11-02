import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Trophy, UsersRound } from "lucide-react";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  CommunityMetrics,
  FriendComparison,
  SponsorAnalytics,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Community · DevTrack" };

const linkClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--control)]";

export default function CommunityPage() {
  return (
    <>
      <PageHeader
        title="Community"
        description="Your open-source footprint: discussions, reviews, friends and sponsors."
        actions={
          <>
            <Link href="/dashboard/friends" className={linkClass}>
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              Compare friends
            </Link>
            <Link href="/dashboard/rooms" className={linkClass}>
              <MessagesSquare className="h-4 w-4" aria-hidden="true" />
              Rooms
            </Link>
            <Link href="/leaderboard" className={linkClass}>
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Leaderboard
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <CommunityMetrics />
        <FriendComparison />
      </div>

      <SectionTitle>Sponsors</SectionTitle>
      <SponsorAnalytics />
    </>
  );
}
