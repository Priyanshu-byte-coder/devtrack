import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { goalId } = await req.json();

  if (!goalId) {
    return Response.json({ error: "goalId required" }, { status: 400 });
  }

  try {
    const { data: goal } = await supabaseAdmin
      .from("goals")
      .select("*")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .single();

    if (!goal) {
      return Response.json({ error: "Goal not found" }, { status: 404 });
    }

    const { data: notification } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: user.id,
        type: "goal_achievement",
        message: `🎉 Congrats! You completed "${goal.title}" goal!`,
        read: false,
      })
      .select()
      .single();

    return Response.json({ notification });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return Response.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
