import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { isMetricsCacheBypassed } from "@/lib/metrics-cache";
import { resolveAppUser } from "@/lib/resolve-user";
import { syncGitHubAchievementsForUser } from "@/lib/github-achievements";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();

  if (!sessionData || !sessionData.session.githubId || !sessionData.session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = sessionData.session;
  const accessToken = sessionData.accessToken;
  const githubLogin = session.githubLogin as string;
  const githubId = session.githubId as string;

  const user = await resolveAppUser(githubId, githubLogin);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncGitHubAchievementsForUser({
    userId: user.id,
    githubLogin,
    token: accessToken,
    force: isMetricsCacheBypassed(req),
  });

  return Response.json(result);
}