import type { Metadata } from "next";
import Link from "next/link";
import { GitCompare, HeartPulse } from "lucide-react";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  InactiveRepos,
  LanguageBreakdown,
  PinnedRepos,
  RepoAnalytics,
  RepoContributionDistribution,
  TopRepos,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Repositories · DevTrack" };

const linkClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--control)]";

export default function RepositoriesPage() {
  return (
    <>
      <PageHeader
        title="Repositories"
        description="Where your work goes, which languages you use and what needs attention."
        actions={
          <>
            <Link href="/dashboard/repo-health" className={linkClass}>
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
              Repo health
            </Link>
            <Link href="/dashboard/repo-comparison" className={linkClass}>
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              Compare repos
            </Link>
          </>
        }
      />

      <RepoAnalytics />

      <SectionTitle>Where your commits go</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <TopRepos />
        <RepoContributionDistribution />
      </div>

      <SectionTitle>Languages &amp; showcase</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <LanguageBreakdown />
        <PinnedRepos />
      </div>

      <SectionTitle>Needs attention</SectionTitle>
      <InactiveRepos />
    </>
  );
}
