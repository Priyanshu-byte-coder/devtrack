import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  try {
    // Get goal statistics
    const { data: goalHistory } = await supabaseAdmin
      .from("goal_history")
      .select("completed")
      .eq("user_id", user.id);

    const completedCount = (goalHistory ?? []).filter((h) => h.completed).length;

    // Define badges
    const badges: Badge[] = [
      {
        id: "first-goal",
        name: "Goal Setter",
        description: "Create your first goal",
        icon: "🎯",
        unlockedAt: completedCount > 0 ? new Date().toISOString() : null,
      },
      {
        id: "goal-master",
        name: "Goal Master",
        description: "Complete 5 goals",
        icon: "🏆",
        unlockedAt: completedCount >= 5 ? new Date().toISOString() : null,
      },
      {
        id: "consistency-king",
        name: "Consistency King",
        description: "Maintain weekly streak for 4 weeks",
        icon: "👑",
        unlockedAt: null, // Dynamic tracking needed
      },
      {
        id: "overachiever",
        name: "Overachiever",
        description: "Exceed goal target by 50%",
        icon: "⚡",
        unlockedAt: null, // Dynamic tracking needed
      },
    ];

    return Response.json({ badges });
  } catch (error) {
    console.error("Failed to get achievements:", error);
    return Response.json(
      { error: "Failed to fetch achievements" },
      { status: 500 }
    );
  }
}
