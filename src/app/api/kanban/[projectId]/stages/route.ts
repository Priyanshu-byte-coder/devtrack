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

  const { name, color, position } = body;
  if (!name) {
    return Response.json({ error: "Stage name is required" }, { status: 400 });
  }
  if (typeof position !== "number") {
    return Response.json({ error: "Position must be a number" }, { status: 400 });
  }

  const { data: stage, error: stageError } = await supabaseAdmin
    .from("workflow_stages")
    .insert({
      project_id: projectId,
      name,
      color: color || "#6366f1",
      position,
    })
    .select("*")
    .single();

  if (stageError) {
    return Response.json({ error: stageError.message }, { status: 500 });
  }

  // Log activity
  await supabaseAdmin.from("activity_log").insert({
    project_id: projectId,
    user_id: user.id,
    action: "stage_created",
    entity_type: "stage",
    entity_id: stage.id,
    metadata: { name: stage.name },
  });

  return Response.json({ stage }, { status: 201 });
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

  const { stages, deleteStageId } = body;

  if (deleteStageId) {
    // Delete the stage
    const { error: deleteError } = await supabaseAdmin
      .from("workflow_stages")
      .delete()
      .eq("id", deleteStageId)
      .eq("project_id", projectId);

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    // Log activity
    await supabaseAdmin.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: "stage_deleted",
      entity_type: "stage",
      entity_id: deleteStageId,
      metadata: { id: deleteStageId },
    });
  }

  if (stages && Array.isArray(stages)) {
    // Bulk upsert/update positions and attributes of stages
    const payload = stages.map((s) => ({
      id: s.id,
      project_id: projectId,
      name: s.name,
      color: s.color || "#6366f1",
      position: s.position,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("workflow_stages")
      .upsert(payload, { onConflict: "id" });

    if (upsertError) {
      return Response.json({ error: upsertError.message }, { status: 500 });
    }

    // Log activity
    await supabaseAdmin.from("activity_log").insert({
      project_id: projectId,
      user_id: user.id,
      action: "stages_reordered",
      entity_type: "stage",
      entity_id: projectId,
      metadata: { count: stages.length },
    });
  }

  return Response.json({ success: true });
}
