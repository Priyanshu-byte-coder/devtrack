import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
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

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(
    session?.githubId ?? session?.githubLogin,
    "commit-times",
    { days: 90 }
  );

  try {
    const result = await withMetricsCache(
      { bypass, key, ttlSeconds: METRICS_CACHE_TTL_SECONDS.contributions },
      async () => {
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const sinceStr = since.toISOString().slice(0, 10);

        // 7 rows (0=Sun … 6=Sat) × 24 cols (hour 0-23)
        const matrix: number[][] = Array.from({ length: 7 }, () =>
          new Array(24).fill(0)
        );

        let page = 1;
        while (true) {
          const res = await fetch(
            `${GITHUB_API}/search/commits?q=author:${session?.githubLogin}+author-date:>=${sinceStr}&per_page=100&page=${page}&sort=author-date&order=desc`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github+json",
              },
              cache: "no-store",
            }
          );
          if (!res.ok) throw new Error("GitHub API error");
          const data = (await res.json()) as {
            items: Array<{ commit: { author: { date: string } } }>;
          };
          for (const item of data.items) {
            const d = new Date(item.commit.author.date);
            matrix[d.getDay()][d.getHours()]++;
          }
          if (data.items.length < 100 || page >= 10) break;
          page++;
        }

        // Find peak slot
        let peakDay = 0;
        let peakHour = 0;
        let peakCount = 0;
        for (let d = 0; d < 7; d++) {
          for (let h = 0; h < 24; h++) {
            if (matrix[d][h] > peakCount) {
              peakCount = matrix[d][h];
              peakDay = d;
              peakHour = h;
            }
          }
        }

        return { matrix, peakDay, peakHour, peakCount };
      }
    );

    return Response.json(result);
  } catch {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}