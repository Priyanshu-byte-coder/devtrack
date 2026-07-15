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

  // Log activity
  await supabaseAdmin.from("activity_log").insert({
    project_id: projectId,
    user_id: user.id,
    action: "task_created",
    entity_type: "task",
    entity_id: task.id,
    metadata: { title: task.title, stage_id: task.stage_id },
  });

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

  const { tasks, deleteTaskId, movedTask, editedTask } = body;

  if (deleteTaskId) {
    // Get task details before deleting for a better log
    const { data: taskToDelete } = await supabaseAdmin
      .from("tasks")
      .select("title")
      .eq("id", deleteTaskId)
      .single();

    // Delete the task
    const { error: deleteError } = await supabaseAdmin
      .from("tasks")
      .delete()
      .eq("id", deleteTaskId)
      .eq("project_id", projectId);

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    // Log activity
    await supabaseAdmin.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: "task_deleted",
      entity_type: "task",
      entity_id: deleteTaskId,
      metadata: { title: taskToDelete?.title || "Deleted Task" },
    });
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

    // Log activity if moved or edited specifically
    if (movedTask) {
      // Find destination stage name
      const { data: stage } = await supabaseAdmin
        .from("workflow_stages")
        .select("name")
        .eq("id", movedTask.toStageId)
        .single();

      await supabaseAdmin.from("activity_log").insert({
        project_id: projectId,
        user_id: user.id,
        action: "task_moved",
        entity_type: "task",
        entity_id: movedTask.id,
        metadata: { title: movedTask.title, stage_name: stage?.name || "new column" },
      });
    } else if (editedTask) {
      await supabaseAdmin.from("activity_log").insert({
        project_id: projectId,
        user_id: user.id,
        action: "task_updated",
        entity_type: "task",
        entity_id: editedTask.id,
        metadata: { title: editedTask.title },
      });
    }
  }

  return Response.json({ success: true });
}
