import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    projectId: string;
    taskId: string;
  }>;
}

export async function POST(req: Request, props: RouteParams) {
  const { projectId, taskId } = await props.params;
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

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { blockingTaskId } = body;
  if (!blockingTaskId) {
    return Response.json({ error: "blockingTaskId is required" }, { status: 400 });
  }

  const { data: dep, error: depError } = await supabaseAdmin
    .from("task_dependencies")
    .insert({
      project_id: projectId,
      blocked_task_id: taskId,
      blocking_task_id: blockingTaskId,
    })
    .select("*")
    .single();

  if (depError) {
    return Response.json({ error: depError.message }, { status: 500 });
  }

  return Response.json({ dependency: dep }, { status: 201 });
}

export async function DELETE(req: Request, props: RouteParams) {
  const { projectId, taskId } = await props.params;
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

  const { searchParams } = new URL(req.url);
  const blockingTaskId = searchParams.get("blockingTaskId");

  if (!blockingTaskId) {
    return Response.json({ error: "blockingTaskId is required" }, { status: 400 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("task_dependencies")
    .delete()
    .eq("project_id", projectId)
    .eq("blocked_task_id", taskId)
    .eq("blocking_task_id", blockingTaskId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
