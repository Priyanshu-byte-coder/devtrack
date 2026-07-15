import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ projects });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "Project name is required" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: user.id,
      name,
    })
    .select("*")
    .single();

  if (projectError || !project) {
    return Response.json({ error: projectError?.message ?? "Failed to create project" }, { status: 500 });
  }

  // Seed default stages: "To Do", "In Progress", "Done"
  const defaultStages = [
    { name: "To Do", position: 0, color: "#6366f1", project_id: project.id },
    { name: "In Progress", position: 1, color: "#f59e0b", project_id: project.id },
    { name: "Done", position: 2, color: "#10b981", project_id: project.id },
  ];

  const { error: stagesError } = await supabaseAdmin
    .from("workflow_stages")
    .insert(defaultStages);

  if (stagesError) {
    // Clean up created project if stage seeding fails
    await supabaseAdmin.from("projects").delete().eq("id", project.id);
    return Response.json({ error: "Failed to seed default stages" }, { status: 500 });
  }

  return Response.json({ project }, { status: 201 });
}
