import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { getAccountToken, getAllAccounts, mergeMetrics } from "@/lib/github-accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { isMetricsCacheBypassed, metricsCacheKey, withMetricsCache } from "@/lib/metrics-cache";
import { fetchCIAnalyticsForAccount, mergeCIAnalytics } from "@/lib/ci-analytics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();
  if (!sessionData || !sessionData.session.githubLogin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const session = sessionData.session;
  const accessToken = sessionData.accessToken;

  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(session.githubId ?? session.githubLogin!, "ci" as any, { accountId: accountId || "default" });

  try {
    const data = await withMetricsCache({ bypass, key, ttlSeconds: 10 * 60 }, async () => {
      if (!accountId) return await fetchCIAnalyticsForAccount(accessToken, session.githubLogin!);

      const userRow = await resolveAppUser(session.githubId!, session.githubLogin!);
      if (!userRow) throw new Error("User not found");

      if (accountId === "combined") {
        const accounts = await getAllAccounts({ token: accessToken, githubId: session.githubId!, githubLogin: session.githubLogin! }, userRow.id);
        const results = await Promise.allSettled(accounts.map((a) => fetchCIAnalyticsForAccount(a.token, a.githubLogin)));
        const merged = mergeMetrics(results, mergeCIAnalytics);
        if (!merged) throw new Error("Merge failed");
        return merged;
      }

      if (accountId === session.githubId) return await fetchCIAnalyticsForAccount(accessToken, session.githubLogin!);

      const accountToken = await getAccountToken(userRow.id, accountId);
      if (!accountToken) throw new Error("Token missing");

      const { data: accountRow } = await supabaseAdmin.from("user_github_accounts").select("github_login").eq("user_id", userRow.id).eq("github_id", accountId).single();
      if (!accountRow?.github_login) throw new Error("Account missing");

      return await fetchCIAnalyticsForAccount(accountToken, accountRow.github_login);
    });

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}