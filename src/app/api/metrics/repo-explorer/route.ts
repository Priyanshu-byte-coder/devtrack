import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { collectAuthorCommits, requireUnthrottled } from "@/lib/github-search";
import { getSessionWithToken } from "@/lib/get-session-token";
import { fetchUserRepos } from "@/lib/github";
import { NextRequest } from "next/server";
import {
  isMetricsCacheBypassed,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { ExplorerRepoCardData } from "@/lib/repo-analytics-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();
  if (!sessionData || !sessionData.session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = sessionData.session;
  const accessToken = sessionData.accessToken;

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(
    session.githubId ?? session.githubLogin!,
    "repo-explorer-v2" as any,
    { days: 7 }
  );

  try {
    const data = await withMetricsCache(
      { bypass, key, ttlSeconds: 30 * 60 },
      async () => {
        // Paginate through all pages (up to 1000 repos) so users with more
        // than 100 repositories see their complete list — fixes #2843.
        const repos = await fetchUserRepos(accessToken, {
          perPage: 100,
          maxPages: 10,
        });
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);

        const { items } = requireUnthrottled(
          await collectAuthorCommits<{
            commit: { author: { date: string } };
            repository: { full_name: string };
          }>(session.githubLogin!, sinceStr, accessToken, { fresh: bypass })
        );

        const repoCommits: Record<string, string[]> = {};
        for (const item of items) {
          const repoName = item.repository.full_name;
          (repoCommits[repoName] ??= []).push(item.commit.author.date);
        }

        const result: ExplorerRepoCardData[] = [];

        for (const repo of repos) {
          const commitDates = repoCommits[repo.full_name] || [];
          const commitCount = commitDates.length;

          const dayMap: Record<string, number> = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dayMap[d.toISOString().slice(0, 10)] = 0;
          }

          for (const dateStr of commitDates) {
            const dStr = dateStr.slice(0, 10);
            if (dayMap[dStr] !== undefined) {
              dayMap[dStr]++;
            }
          }

          const activity7d = Object.entries(dayMap).map(([date, count]) => {
            const d = new Date(date);
            const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
            return { day: dayName, commits: count };
          });

          result.push({
            id: String(repo.id),
            name: repo.name,
            fullName: repo.full_name,
            commitCount,
            createdAt: repo.created_at,
            updatedAt: repo.updated_at,
            primaryLanguage: repo.language ?? undefined,
            htmlUrl: repo.html_url,
            activity7d,
          });
        }

        result.sort(
          (a, b) =>
            b.commitCount - a.commitCount ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        return { repos: result };
      }
    );
    return Response.json(data);
  } catch (error) {
    const githubLimit = githubRateLimitResponse(error);
    if (githubLimit) return githubLimit;

    console.error(error);
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
