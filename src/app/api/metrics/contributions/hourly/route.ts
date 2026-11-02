import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { collectAuthorCommits, requireUnthrottled } from "@/lib/github-search";
import { getServerSession } from "@/lib/server-session";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const parsedDays = daysParam ? parseInt(daysParam, 10) : NaN;
  const days = Number.isNaN(parsedDays)
    ? 30
    : Math.max(1, Math.min(365, parsedDays));
  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(
    session.githubId ?? session.githubLogin,
    "contributions",
    { days }
  );

  try {
    const result = await withMetricsCache(
      {
        bypass,
        key,
        ttlSeconds: METRICS_CACHE_TTL_SECONDS.contributions,
      },
      async () => {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().slice(0, 10);

        const { items: allItems } = requireUnthrottled(
          await collectAuthorCommits(
            session.githubLogin!,
            sinceStr,
            session.accessToken,
            {
              fresh: bypass,
            }
          )
        );

        // Initialize all 24 hours to 0
        const hourMap: Record<number, number> = {};
        for (let i = 0; i < 24; i++) hourMap[i] = 0;

        for (const item of allItems) {
          const date = new Date(item.commit.author.date);
          const hour = date.getHours();
          hourMap[hour]++;
        }

        const hours = Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          commits: hourMap[i],
        }));

        return { days, hours };
      }
    );

    return Response.json(result);
  } catch (e) {
    const githubLimit = githubRateLimitResponse(e);
    if (githubLimit) return githubLimit;

    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
