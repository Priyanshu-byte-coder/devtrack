import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { isMetricsCacheBypassed, metricsCacheKey, withMetricsCache, METRICS_CACHE_TTL_SECONDS} from "@/lib/metrics-cache";
import { getAccountToken } from "@/lib/github-accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";
const GITHUB_API = "https://api.github.com";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken || !session?.githubLogin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  let token = accessToken;
  let githubLogin = session?.githubLogin;
  let userId = session?.githubId ?? session?.githubLogin;

  if (accountId && accountId !== session?.githubId) {
    if (!session?.githubId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRow = await resolveAppUser(session?.githubId, session?.githubLogin);
    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accountToken = await getAccountToken(userRow.id, accountId);
    if (!accountToken) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }
    const { data: accountRow } = await supabaseAdmin
      .from("user_github_accounts")
      .select("github_login")
      .eq("user_id", userRow.id)
      .eq("github_id", accountId)
      .single();
    if (!accountRow?.github_login) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }
    token = accountToken;
    githubLogin = accountRow.github_login;
    userId = accountId;
  }

  const key = metricsCacheKey(
    userId,
    "languages" as any,
    { accountId: accountId || undefined }
  );

  try {
    const data = await withMetricsCache({ bypass, key, ttlSeconds: METRICS_CACHE_TTL_SECONDS.languages }, async () => {
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
      const since = new Date();
      const rawDays = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10);    const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 90;

      const searchRes = await fetch(
        `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${since.toISOString().slice(0, 10)}&per_page=100&sort=author-date&order=desc`,
        { headers, cache: "no-store" }
      );
      if (!searchRes.ok) throw new Error("API Error");

      const raw = await searchRes.json();
      const repoNames = Array.from(new Set<string>(raw.items.map((i: any) => i.repository.full_name)));
      const topRepoNames = repoNames.slice(0, 20);
      const langTotals: Record<string, number> = {};
      const failedRepos: Array<{ name: string; statusCode?: number; error: string }> = [];

      await Promise.all(
        topRepoNames.map(async (repoName) => {
          try {
              const repoCacheKey = metricsCacheKey(
                userId,
                "repo_languages" as any,
                { repoName }
                );

              const langs = await withMetricsCache(
                {
                  bypass,
                  key: repoCacheKey,
                  ttlSeconds: METRICS_CACHE_TTL_SECONDS.languages,
                },
                async () => {
                  const res = await fetch(
                    `${GITHUB_API}/repos/${repoName}/languages`,
                    { headers, cache: "no-store" },
                  );

                  if (!res.ok) {
                    failedRepos.push({
                      name: repoName,
                      statusCode: res.status,
                      error: `GitHub API returned ${res.status}`,
                    });
                    return {};
                  }

                  return await res.json();
                },
              );
            for (const [lang, bytes] of Object.entries(langs)) {
              langTotals[lang] = (langTotals[lang] ?? 0) + (bytes as number);
            }
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Unknown error";
            failedRepos.push({
              name: repoName,
              error: errorMessage,
            });
            console.warn(
              `[METRICS] Failed to fetch languages for ${repoName}: ${errorMessage}`,
              { userId, githubLogin }
            );
          }
        })
      );

      const totalBytes = Object.values(langTotals).reduce((s, b) => s + b, 0);
      const languages = Object.entries(langTotals)
        .map(([name, bytes]) => ({ name, bytes, percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0 }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 6);

      const isComplete = failedRepos.length === 0;
      
      return {
        languages,
        isComplete,
        failedRepositoriesCount: failedRepos.length,
        ...(process.env.NODE_ENV === "development" && { failedRepositories: failedRepos }),
      };
    });
    return Response.json(data);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("[METRICS] Language metrics endpoint error", {
      userId: session?.githubId ?? session?.githubLogin,
      error: errorMessage,
    });
    return Response.json({ error: "GitHub API error", isComplete: false }, { status: 502 });
  }
}
