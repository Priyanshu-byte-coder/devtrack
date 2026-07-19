import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import RepoHealthExplorer from "@/components/repo-health/RepoHealthExplorer";

export const metadata = {
  title: "Repository Health Explorer — DevTrack",
  description:
    "Interactive health breakdown, radar chart, score analysis, and recommendations for your most active GitHub repositories.",
};

export default async function RepoHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  return <RepoHealthExplorer />;
}
