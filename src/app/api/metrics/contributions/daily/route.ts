import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { GITHUB_API } from "@/lib/github";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

interface RepoCommit {
  repo: string;
  count: number;
  url: string;
}

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();
  if (!sessionData || !sessionData.session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = sessionData.session;
  const accessToken = sessionData.accessToken;

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Missing or invalid date" }, { status: 400 });
  }

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(
    session.githubId ?? session.githubLogin!,
    "contributions",
    { date }
  );

  try {
    const result = await withMetricsCache(
      {
        bypass,
        key,
        ttlSeconds: METRICS_CACHE_TTL_SECONDS.contributions,
      },
      async () => {
        const searchRes = await fetch(
          `${GITHUB_API}/search/commits?q=author:${session.githubLogin}+author-date:${date}&per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          }
        );

        if (!searchRes.ok) throw new Error("GitHub API error");

        const data = (await searchRes.json()) as {
          items: Array<{
            repository: { full_name: string; html_url: string };
          }>;
        };

        const repoMap: Record<string, { count: number; url: string }> = {};
        for (const item of data.items) {
          const { full_name, html_url } = item.repository;
          if (!repoMap[full_name]) {
            repoMap[full_name] = { count: 0, url: html_url };
          }
          repoMap[full_name].count++;
        }

        const repos: RepoCommit[] = Object.entries(repoMap).map(
          ([repo, { count, url }]) => ({ repo, count, url })
        );

        return { date, repos };
      }
    );

    return Response.json(result);
  } catch (e) {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}