import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

export async function GET(req: Request, props: RouteParams) {
  const { projectId } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Verify project belongs to user
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Get stages
  const { data: stages, error: stagesError } = await supabaseAdmin
    .from("workflow_stages")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (stagesError) {
    return Response.json({ error: stagesError.message }, { status: 500 });
  }

  // Get tasks
  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (tasksError) {
    return Response.json({ error: tasksError.message }, { status: 500 });
  }

  return Response.json({ project, stages, tasks });
}

export async function DELETE(req: Request, props: RouteParams) {
  const { projectId } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Delete project (cascade will delete stages and tasks)
  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
