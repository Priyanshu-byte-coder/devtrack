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

  const { data: tasks, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify(tasks), {
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
    const title = stripHtml(body.title || "").trim();
    const milestone_id = body.milestoneId || null;
    const status = stripHtml(body.status || "todo").trim();
    const priority = stripHtml(body.priority || "medium").trim();
    const due_date = body.dueDate || null;
    const tags = Array.isArray(body.tags) ? body.tags.map((t: string) => stripHtml(t).trim()) : [];
    const recurrence_config = body.recurrence_config || null;

    if (!title) {
      return new Response("Title is required", { status: 400 });
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        user_id: appUser.id,
        title,
        milestone_id,
        completed: false,
        status,
        priority,
        due_date,
        tags,
        recurrence_config,
        recurrence_count: 0
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(task), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}
