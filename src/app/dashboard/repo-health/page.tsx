import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import RepoHealthExplorer from "@/components/repo-health/RepoHealthExplorer";

export const metadata = {
  title: "Repository health",
  description:
    "Interactive health breakdown, radar chart, score analysis, and recommendations for your most active GitHub repositories.",
};

export default async function RepoHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  return <RepoHealthExplorer />;
}
