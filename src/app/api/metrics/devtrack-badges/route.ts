import { getServerSession } from "next-auth";
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

export interface CommunityEngagementScore {
  total: number; // 0-100
  breakdown: {
    reviews: { count: number; points: number };
    issuesOpened: { count: number; points: number };
    issuesClosed: { count: number; points: number };
    discussions: { count: number; points: number };
    openSourcePrs: { count: number; points: number };
    documentationPrs: { count: number; points: number };
  };
  label: "Newcomer" | "Contributor" | "Collaborator" | "Community Champion";
}

function scoreLabel(total: number): CommunityEngagementScore["label"] {
  if (total >= 75) return "Community Champion";
  if (total >= 50) return "Collaborator";
  if (total >= 25) return "Contributor";
  return "Newcomer";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  const key = metricsCacheKey(
    session.githubId ?? session.githubLogin,
    "community-engagement" as any,
    { since: sinceStr }
  );
  const bypass = isMetricsCacheBypassed(req);

  const data = await withMetricsCache(
    { bypass, key, ttlSeconds: METRICS_CACHE_TTL_SECONDS.contributions },
    async () => {
      const headers = {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/vnd.github+json",
      };

      const [reviewsRes, issuesOpenRes, issuesClosedRes, openSourceRes, docsRes] =
        await Promise.allSettled([
          fetch(
            `${GITHUB_API}/search/issues?q=reviewed-by:${session.githubLogin}+type:pr+updated:>=${sinceStr}&per_page=1`,
            { headers, cache: "no-store" }
          ),
          fetch(
            `${GITHUB_API}/search/issues?q=author:${session.githubLogin}+type:issue+created:>=${sinceStr}&per_page=1`,
            { headers, cache: "no-store" }
          ),
          fetch(
            `${GITHUB_API}/search/issues?q=assignee:${session.githubLogin}+type:issue+state:closed+closed:>=${sinceStr}&per_page=1`,
            { headers, cache: "no-store" }
          ),
          fetch(
            `${GITHUB_API}/search/issues?q=author:${session.githubLogin}+type:pr+is:merged+-user:${session.githubLogin}+merged:>=${sinceStr}&per_page=1`,
            { headers, cache: "no-store" }
          ),
          fetch(
            `${GITHUB_API}/search/issues?q=author:${session.githubLogin}+type:pr+is:merged+label:documentation+merged:>=${sinceStr}&per_page=1`,
            { headers, cache: "no-store" }
          ),
        ]);

      const getCount = async (r: PromiseSettledResult<Response>) => {
        if (r.status !== "fulfilled" || !r.value.ok) return 0;
        const d = (await r.value.json()) as { total_count?: number };
        return d.total_count ?? 0;
      };

      const [reviews, issuesOpened, issuesClosed, openSourcePrs, documentationPrs] =
        await Promise.all([
          getCount(reviewsRes),
          getCount(issuesOpenRes),
          getCount(issuesClosedRes),
          getCount(openSourceRes),
          getCount(docsRes),
        ]);

      // Weighted scoring (max 100)
      const reviewPoints = Math.min(reviews * 3, 30);
      const issuesOpenedPoints = Math.min(issuesOpened * 2, 15);
      const issuesClosedPoints = Math.min(issuesClosed * 3, 20);
      const discussionsPoints = 0; // placeholder — GitHub Discussions API requires GraphQL
      const openSourcePoints = Math.min(openSourcePrs * 5, 25);
      const documentationPoints = Math.min(documentationPrs * 5, 10);

      const total = Math.min(
        reviewPoints +
          issuesOpenedPoints +
          issuesClosedPoints +
          discussionsPoints +
          openSourcePoints +
          documentationPoints,
        100
      );

      const score: CommunityEngagementScore = {
        total,
        breakdown: {
          reviews: { count: reviews, points: reviewPoints },
          issuesOpened: { count: issuesOpened, points: issuesOpenedPoints },
          issuesClosed: { count: issuesClosed, points: issuesClosedPoints },
          discussions: { count: 0, points: discussionsPoints },
          openSourcePrs: { count: openSourcePrs, points: openSourcePoints },
          documentationPrs: { count: documentationPrs, points: documentationPoints },
        },
        label: scoreLabel(total),
      };

      return score;
    }
  );

  return Response.json(data);
}