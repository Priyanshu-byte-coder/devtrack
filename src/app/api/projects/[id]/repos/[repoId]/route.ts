import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string; repoId: string }>;
};

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id, repoId } = await params;

  // Verify project ownership
  const { data: project, error: projectError } = await supabaseAdmin
    .from("devtrack_projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Delete repo link
  const { error } = await supabaseAdmin
    .from("devtrack_repositories")
    .delete()
    .eq("id", repoId)
    .eq("project_id", id);

  if (error) {
    console.error("Failed to delete repository link:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
