import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

const MAX_HISTORY_ROWS = 50;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { data: history, error } = await supabaseAdmin
    .from("goal_history")
    .select(
      `
      id,
      goal_id,
      period_start,
      period_end,
      target,
      achieved,
      completed,
      goals ( title, unit )
      `
    )
    .eq("user_id", user.id)
    .order("period_end", { ascending: false })
    .limit(MAX_HISTORY_ROWS);

  if (error) {
    console.error("Failed to fetch goal history:", error);
    return Response.json({ error: "Failed to fetch goal history" }, { status: 500 });
  }

  // Flatten the joined goals relation into flat fields
  const flat = (history ?? []).map((row) => {
    const goal = Array.isArray(row.goals) ? row.goals[0] : row.goals;
    return {
      id: row.id,
      goal_id: row.goal_id,
      goal_title: goal?.title ?? "Deleted goal",
      goal_unit: goal?.unit ?? "",
      period_start: row.period_start,
      period_end: row.period_end,
      target: row.target,
      achieved: row.achieved,
      completed: row.completed,
    };
  });

  return Response.json({ history: flat });
}
