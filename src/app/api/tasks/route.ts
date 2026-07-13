import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (tasksError) {
    return Response.json({ error: "Failed to load tasks" }, { status: 500 });
  }

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("time_entries")
    .select("task_id, duration_minutes")
    .eq("user_id", user.id);

  if (entriesError) {
    return Response.json({ error: "Failed to load time entries" }, { status: 500 });
  }

  const totalsByTask = new Map<string, number>();
  for (const entry of entries ?? []) {
    const current = totalsByTask.get(entry.task_id) ?? 0;
    totalsByTask.set(entry.task_id, current + entry.duration_minutes);
  }

  const tasksWithTotals = (tasks ?? []).map((task) => ({
    ...task,
    totalMinutes: totalsByTask.get(task.id) ?? 0,
  }));

  return Response.json({ tasks: tasksWithTotals });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { title?: string };

  if (!body.title || !body.title.trim()) {
    return Response.json({ error: "title required" }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { data: task, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      user_id: user.id,
      title: body.title.trim(),
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ task: { ...task, totalMinutes: 0 } }, { status: 201 });
}
