import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { syncSponsorMetricsForUser } from "@/lib/sponsors";
import { githubAuthErrorResponse } from "@/lib/github-fetch";
import { isSupabaseAdminAvailable } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const githubId = session?.githubId;
  const githubLogin = session?.githubLogin;
  if (!githubId || !githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = isSupabaseAdminAvailable
    ? (await resolveAppUser(githubId, githubLogin))?.id
    : "mock-user-id";

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "true";

  try {
    const data = await syncSponsorMetricsForUser({
      userId,
      token: accessToken,
      force,
    });
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: "Failed to fetch sponsors" }, { status: 502 });
  }
}
