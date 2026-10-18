import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProjectTutorClient from "@/components/ProjectTutorClient";

export const metadata = { title: "Project tutor · DevTrack" };

export default async function ProjectTutorPage() {
  const session = await getServerSession(authOptions);
  if (!session)
    redirect("/api/auth/signin/github?callbackUrl=/dashboard/project-tutor");

  return <ProjectTutorClient />;
}
