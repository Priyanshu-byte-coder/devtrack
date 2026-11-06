import type { Metadata } from "next";
import PageHeader, { SectionTitle } from "@/components/shell/PageHeader";
import {
  CIAnalytics,
  IssueMetrics,
  PRMetrics,
} from "@/components/dashboard/widgets";

export const metadata: Metadata = { title: "Pull requests" };

export default function PullRequestsPage() {
  return (
    <>
      <PageHeader
        title="Pull requests"
        description="What you shipped, how fast it merged, what's still waiting and the reviews you gave."
      />

      <PRMetrics />

      <SectionTitle>Issues &amp; CI</SectionTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <IssueMetrics />
        <CIAnalytics />
      </div>
    </>
  );
}
