import { getServerSession } from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  GitHubApiError,
  GitHubAuthError,
  GitHubRateLimitError,
  githubAuthErrorResponse,
  githubGraphQL,
} from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

interface PinnedRepo {
  name: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string; color: string } | null;
}

interface PinnedReposQueryResult {
  viewer?: {
    pinnedItems?: {
      nodes?: Array<PinnedRepo | null | undefined>;
    };
  };
}

const PINNED_REPOS_QUERY = `
  query {
    viewer {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            name
            description
            url
            stargazerCount
            forkCount
            primaryLanguage {
              name
              color
            }
          }
        }
      }
    }
  }
`;

export async function GET(req?: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const accessToken = session.accessToken;
  const cacheUserId = session.githubId ?? session.githubLogin;

  if (!cacheUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bypass = req ? isMetricsCacheBypassed(req) : false;
  const key = metricsCacheKey(cacheUserId, "pinned-repos");

  try {
    const result = await withMetricsCache(
      {
        bypass,
        key,
        ttlSeconds: METRICS_CACHE_TTL_SECONDS["pinned-repos"],
        fallbackToStaleOnError: (error) =>
          error instanceof GitHubRateLimitError,
      },
      async () => {
        const data = await githubGraphQL<PinnedReposQueryResult>(
          PINNED_REPOS_QUERY,
          accessToken
        );

        const nodes = (data.viewer?.pinnedItems?.nodes ?? []).filter(
          (node): node is PinnedRepo => node != null
        );

        return { pinnedRepos: nodes };
      }
    );

    return Response.json(result);
  } catch (error) {
    if (
      error instanceof GitHubAuthError ||
      (error instanceof GitHubApiError && error.status === 401)
    ) {
      return githubAuthErrorResponse();
    }

    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
