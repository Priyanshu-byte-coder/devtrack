import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "@/components/Link";
import { GitCompare, HeartPulse } from "lucide-react";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  DiffTrend,
  InactiveRepos,
  LanguageBreakdown,
  PinnedRepos,
  RepoAnalytics,
  RepoContributionDistribution,
  TopRepos,
} from "@/components/dashboard/widgets";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("repositories");
  return { title: t("pageTitle") };
}

const linkClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--card-foreground)] hover:bg-[var(--control)]";

export default async function RepositoriesPage() {
  const t = await getTranslations("repositories");

  return (
    <>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        actions={
          <>
            <Link href="/dashboard/repo-health" className={linkClass}>
              <HeartPulse className="h-4 w-4" aria-hidden="true" />
              {t("actions.repoHealth")}
            </Link>
            <Link href="/dashboard/repo-comparison" className={linkClass}>
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              {t("actions.compareRepos")}
            </Link>
          </>
        }
      />

      <RepoAnalytics />

      <SectionTitle>{t("sections.commitsDestination")}</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <TopRepos />
        <RepoContributionDistribution />
        <div className="xl:col-span-2">
          <DiffTrend />
        </div>
      </div>

      <SectionTitle>{t("sections.languagesAndShowcase")}</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <LanguageBreakdown />
        <PinnedRepos />
      </div>

      <SectionTitle>{t("sections.needsAttention")}</SectionTitle>
      <InactiveRepos />
    </>
  );
}
