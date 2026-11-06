import { getServerSession } from "@/lib/server-session";
import { resolveAppUser } from "@/lib/resolve-user";
import { syncGoalsForUser, GoalDatabaseError } from "@/lib/goals-sync";
import { githubRateLimitResponse } from "@/lib/github-rate-limit";
export const dynamic = 'force-dynamic';
export async function POST() {
  const session = await getServerSession();
  if (!session?.githubId || !session.githubLogin || !session.accessToken) return Response.json({error:'Unauthorized'},{status:401});
  const user = await resolveAppUser(session.githubId,session.githubLogin);
  if (!user) return Response.json({error:'User not found'},{status:404});
  try { return Response.json(await syncGoalsForUser(user.id,session.githubLogin,session.accessToken)); }
  catch (error) {
    const limited = githubRateLimitResponse(error);
    if (limited) return limited;
    return Response.json({error: error instanceof Error ? error.message : 'Goal sync failed'},{status:error instanceof GoalDatabaseError ? 500 : 502});
  }
}
