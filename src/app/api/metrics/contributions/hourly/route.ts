import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { getAccessToken } from "@/lib/get-session-token";
import { authOptions } from "@/lib/auth";
import { GITHUB_API } from "@/lib/github";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken || !session?.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const parsedDays = daysParam ? parseInt(daysParam, 10) : NaN;
  const days = isNaN(parsedDays) ? 30 : Math.max(1, Math.min(365, parsedDays));
  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(
    session?.githubId ?? session?.githubLogin,
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

        const allItems: Array<{ commit: { author: { date: string } } }> = [];
        let page = 1;

        while (true) {
          const searchRes = await fetch(
            `${GITHUB_API}/search/commits?q=author:${session?.githubLogin}+author-date:>=${sinceStr}&per_page=100&page=${page}&sort=author-date&order=desc`,
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
            items: Array<{ commit: { author: { date: string } } }>;
          };
          allItems.push(...data.items);
          if (data.items.length < 100 || page >= 10) break;
          page++;
        }

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
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
