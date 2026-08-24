import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { stripHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) {
    return new Response("User not found", { status: 404 });
  }

  const { data: milestones, error } = await supabaseAdmin
    .from("milestones")
    .select("id, name, description, due_date")
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  // Fetch tasks to calculate taskIds and completion status per milestone
  const { data: tasks, error: taskError } = await supabaseAdmin
    .from("tasks")
    .select("id, milestone_id, completed")
    .eq("user_id", appUser.id)
    .not("milestone_id", "is", null);

  if (taskError) {
    return new Response(taskError.message, { status: 500 });
  }

  const result = milestones.map((m) => {
    const mTasks = tasks.filter((t) => t.milestone_id === m.id);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      dueDate: m.due_date,
      taskIds: mTasks.map((t) => t.id),
      totalTasks: mTasks.length,
      completedTasks: mTasks.filter((t) => t.completed).length,
    };
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUser = await resolveAppUser(session.githubId, session.githubLogin);
  if (!appUser) {
    return new Response("User not found", { status: 404 });
  }

  try {
    const body = await req.json();
    const name = stripHtml(body.name || "").trim();
    const description = stripHtml(body.description || "").trim();
    const dueDate = body.dueDate || null;
    const taskIds = body.taskIds || [];

    if (!name) {
      return new Response("Name is required", { status: 400 });
    }

    const { data: milestone, error } = await supabaseAdmin
      .from("milestones")
      .insert({
        user_id: appUser.id,
        name,
        description,
        due_date: dueDate,
      })
      .select()
      .single();

    if (error) throw error;

    // Link tasks if any
    if (taskIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("tasks")
        .update({ milestone_id: milestone.id })
        .in("id", taskIds)
        .eq("user_id", appUser.id);
      
      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify(milestone), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}
