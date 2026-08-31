import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { resolveAppUser } from "@/lib/resolve-user";
import {
  buildLockedAchievementProgress,
  type AchievementProgressInfo,
} from "@/lib/achievement-progress";

export const dynamic = "force-dynamic";

// --- GraphQL query -----------------------------------------------------------

/**
 * Single round-trip that fetches the two metrics used as proxies:
 *   - Total merged pull requests the viewer has opened
 *   - Total discussion comments marked as accepted answers by the viewer
 */
const ACHIEVEMENT_PROGRESS_QUERY = `
  query AchievementProgress {
    viewer {
      pullRequests(states: [MERGED]) {
        totalCount
      }
      repositoryDiscussionComments(onlyAnswers: true) {
        totalCount
      }
    }
  }
`;

interface AchievementProgressQueryResult {
  data?: {
    viewer?: {
      pullRequests?: { totalCount?: number | null } | null;
      repositoryDiscussionComments?: { totalCount?: number | null } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

// --- Data fetcher ------------------------------------------------------------

async function fetchAchievementMetrics(
  token: string,
  userId: string,
  bypass: boolean
): Promise<{ mergedPRs: number; acceptedAnswers: number }> {
  const key = metricsCacheKey(userId, "achievement-progress");

  return withMetricsCache(
    {
      bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS["achievement-progress"],
    },
    async () => {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: ACHIEVEMENT_PROGRESS_QUERY }),
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401) throw new GitHubAuthError();
        throw new Error(`GitHub GraphQL error: ${response.status}`);
      }

      const json = (await response.json()) as AchievementProgressQueryResult;

      if (json.errors?.length) {
        throw new Error(json.errors[0]?.message ?? "GraphQL error");
      }

      const viewer = json.data?.viewer;
      return {
        mergedPRs: viewer?.pullRequests?.totalCount ?? 0,
        acceptedAnswers: viewer?.repositoryDiscussionComments?.totalCount ?? 0,
      };
    }
  );
}

// --- Route handler -----------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken || !session.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bypass = isMetricsCacheBypassed(req);

  let metrics: { mergedPRs: number; acceptedAnswers: number } | null;
  try {
    metrics = await fetchAchievementMetrics(session.accessToken, user.id, bypass);
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      return githubAuthErrorResponse();
    }
    console.error("[achievement-progress] fetch error", err);
    // Return graceful degradation instead of hard error.
    metrics = null;
  }

  const progress: AchievementProgressInfo[] = buildLockedAchievementProgress(
    metrics,
    new Set<string>()
  );

  return Response.json(progress);
}
