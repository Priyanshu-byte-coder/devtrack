import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Swords, Trophy } from "lucide-react";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  CommunityMetrics,
  SponsorAnalytics,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Community" };

const linkClass =
  "inline-flex items-center gap-1.5 border-2 border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--card-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]";

export default function CommunityPage() {
  return (
    <>
      <PageHeader
        title="Community"
        description="Your open-source footprint: discussions, reviews, friends and sponsors."
        actions={
          <>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <CommunityMetrics />

        {/* Comparing lives in the duel arena; this card points there. */}
        <section
          aria-labelledby="duel-cta"
          className="px-frame flex flex-col bg-[var(--card)] p-6"
        >
          <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
            Versus mode
          </p>
          <h2
            id="duel-cta"
            className="mt-2 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]"
          >
            Duel a friend
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Put your streak, commits, PRs and reviews against anyone on GitHub,
            round by round, and share the result.
          </p>
          <div className="-m-1 mt-5">
            <Link href="/compare" className="px-btn">
              <Swords className="h-4 w-4" aria-hidden="true" />
              Start a duel
            </Link>
          </div>
          <Link
            href="/dashboard/friends"
            className="mt-4 text-xs text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
          >
            Or overlay a friend&apos;s commit graph on yours →
          </Link>
        </section>
      </div>

      <SectionTitle>Sponsors</SectionTitle>
      <SponsorAnalytics />
    </>
  );
}
