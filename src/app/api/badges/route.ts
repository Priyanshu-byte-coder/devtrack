import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { resolveServerGitHubToken } from "@/lib/github-app";
import { fetchPublicPullRequests, fetchPublicStreak } from "@/lib/public-profile-data";
import { supabaseAdmin } from "@/lib/supabase";
import { evaluateBadges, checkEarlyBirdPR } from "@/lib/badges/badge-evaluator";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubLogin || !session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const githubToken = await resolveServerGitHubToken();

  // Fetch all required data in parallel
  const [streakData, pullRequestsCount, hasEarlyBird] = await Promise.all([
    fetchPublicStreak(user.github_login, githubToken, user.timezone),
    fetchPublicPullRequests(user.github_login, githubToken),
    checkEarlyBirdPR(user.github_login, githubToken ?? ""),
  ]);

  // Fetch completed goals
  const { data: goalsData } = await supabaseAdmin
    .from("goals")
    .select("current, target")
    .eq("user_id", user.id);

  let completedGoalsCount = 0;
  if (goalsData) {
    completedGoalsCount = goalsData.filter(g => g.current >= g.target).length;
  }

  const metrics = {
    currentStreak: streakData.current,
    mergedPRs: pullRequestsCount,
    completedGoals: completedGoalsCount,
  };

  const badgeStatus = evaluateBadges(metrics, hasEarlyBird);

  return Response.json({ badges: badgeStatus });
}
