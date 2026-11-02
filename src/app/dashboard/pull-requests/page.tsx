import type { Metadata } from "next";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  CIAnalytics,
  IssueMetrics,
  PRBreakdown,
  PRMetrics,
  PRReviewTrend,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Pull requests · DevTrack" };

export default function PullRequestsPage() {
  return (
    <>
      <PageHeader
        title="Pull requests"
        description="Throughput, review speed and what your PRs are made of."
      />

      <PRMetrics />

      <SectionTitle>Breakdown &amp; reviews</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <PRBreakdown />
        <PRReviewTrend />
      </div>

      <SectionTitle>Issues &amp; CI</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <IssueMetrics />
        <CIAnalytics />
      </div>
    </>
  );
}
