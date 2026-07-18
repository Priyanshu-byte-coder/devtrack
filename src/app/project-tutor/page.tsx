import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProjectTutorClient from "@/components/ProjectTutorClient";

export default async function ProjectTutorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/api/auth/signin/github?callbackUrl=/project-tutor");

  return <ProjectTutorClient username={session.user?.name ?? ""} />;
}