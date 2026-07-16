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

  try {
    // Get user metrics
    const { data: metrics } = await supabaseAdmin
      .from("metric_snapshots")
      .select("commits, prs_merged")
      .eq("user_id", user.id)
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .single();

    // Get existing goals
    const { data: existingGoals } = await supabaseAdmin
      .from("goals")
      .select("unit")
      .eq("user_id", user.id);

    const existingUnits = new Set((existingGoals ?? []).map((g) => g.unit));

    const suggestions = [];

    if (!existingUnits.has("commits")) {
      suggestions.push({
        title: "Weekly Commits",
        target: 5,
        unit: "commits",
        recurrence: "weekly",
        reason: "Based on typical developer activity",
      });
    }

    if (!existingUnits.has("prs")) {
      suggestions.push({
        title: "Monthly Pull Requests",
        target: 8,
        unit: "prs",
        recurrence: "monthly",
        reason: "Build review expertise",
      });
    }

    if (!existingUnits.has("streak")) {
      suggestions.push({
        title: "7-Day Contribution Streak",
        target: 7,
        unit: "streak",
        recurrence: "none",
        reason: "Stay consistent with your coding",
      });
    }

    return Response.json({ suggestions });
  } catch (error) {
    console.error("Failed to get suggestions:", error);
    return Response.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
