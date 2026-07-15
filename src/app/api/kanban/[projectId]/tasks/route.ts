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

export async function POST(req: Request, props: RouteParams) {
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

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, description, stageId, position } = body;
  if (!title) {
    return Response.json({ error: "Task title is required" }, { status: 400 });
  }
  if (!stageId) {
    return Response.json({ error: "Stage ID is required" }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabaseAdmin
    .from("tasks")
    .insert({
      project_id: projectId,
      stage_id: stageId,
      title,
      description: description || "",
      position: typeof position === "number" ? position : 0,
    })
    .select("*")
    .single();

  if (taskError) {
    return Response.json({ error: taskError.message }, { status: 500 });
  }

  return Response.json({ task }, { status: 201 });
}

export async function PUT(req: Request, props: RouteParams) {
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

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tasks, deleteTaskId } = body;

  if (deleteTaskId) {
    // Delete the task
    const { error: deleteError } = await supabaseAdmin
      .from("tasks")
      .delete()
      .eq("id", deleteTaskId)
      .eq("project_id", projectId);

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }
  }

  if (tasks && Array.isArray(tasks)) {
    // Bulk upsert/update positions and attributes of tasks
    const payload = tasks.map((t) => ({
      id: t.id,
      project_id: projectId,
      stage_id: t.stage_id,
      title: t.title,
      description: t.description || "",
      position: t.position,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("tasks")
      .upsert(payload, { onConflict: "id" });

    if (upsertError) {
      return Response.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return Response.json({ success: true });
}
