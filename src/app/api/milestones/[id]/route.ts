import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { stripHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) return new Response("User not found", { status: 404 });

  try {
    const body = await req.json();
    const name = stripHtml(body.name || "").trim();
    const description = stripHtml(body.description || "").trim();
    const dueDate = body.dueDate || null;
    const taskIds = body.taskIds || [];

    if (!name) {
      return new Response("Name is required", { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("milestones")
      .select("id")
      .eq("id", id)
      .eq("user_id", appUser.id)
      .single();

    if (!existing) {
      return new Response("Milestone not found", { status: 404 });
    }

    const { data: milestone, error } = await supabaseAdmin
      .from("milestones")
      .update({
        name,
        description,
        due_date: dueDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", appUser.id)
      .select()
      .single();

    if (error) throw error;

    // First unlink any tasks currently linked to this milestone
    const { error: unlinkError } = await supabaseAdmin
      .from("tasks")
      .update({ milestone_id: null })
      .eq("milestone_id", id)
      .eq("user_id", appUser.id);
    if (unlinkError) throw unlinkError;

    // Link the new tasks
    if (taskIds.length > 0) {
      const { error: linkError } = await supabaseAdmin
        .from("tasks")
        .update({ milestone_id: id })
        .in("id", taskIds)
        .eq("user_id", appUser.id);
      if (linkError) throw linkError;
    }

    return new Response(JSON.stringify(milestone), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) return new Response("User not found", { status: 404 });

  const { error } = await supabaseAdmin
    .from("milestones")
    .delete()
    .eq("id", id)
    .eq("user_id", appUser.id);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
