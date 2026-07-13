import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getAuthenticatedUserAndTask(taskId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (!user) {
    return { error: Response.json({ error: "User not found" }, { status: 404 }) };
  }

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .single();

  if (!task) {
    return { error: Response.json({ error: "Task not found" }, { status: 404 }) };
  }

  return { userId: user.id as string };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const result = await getAuthenticatedUserAndTask(params.id);
  if (result.error) return result.error;

  const { data: entries, error } = await supabaseAdmin
    .from("time_entries")
    .select("*")
    .eq("task_id", params.id)
    .eq("user_id", result.userId)
    .order("started_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to load time entries" }, { status: 500 });
  }

  return Response.json({ entries: entries ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const result = await getAuthenticatedUserAndTask(params.id);
  if (result.error) return result.error;

  const body = (await req.json()) as { startedAt?: string; endedAt?: string };

  if (!body.startedAt || !body.endedAt) {
    return Response.json({ error: "startedAt and endedAt required" }, { status: 400 });
  }

  const startedAt = new Date(body.startedAt);
  const endedAt = new Date(body.endedAt);

  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return Response.json({ error: "Invalid date value" }, { status: 400 });
  }

  if (endedAt <= startedAt) {
    return Response.json({ error: "endedAt must be after startedAt" }, { status: 400 });
  }

  // Duration is computed server-side from the timestamps, never trusted
  // from the client, so a manipulated request can't inflate logged time.
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  const { data: entry, error } = await supabaseAdmin
    .from("time_entries")
    .insert({
      task_id: params.id,
      user_id: result.userId,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ entry }, { status: 201 });
}
