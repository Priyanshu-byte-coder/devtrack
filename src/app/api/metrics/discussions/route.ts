import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  getAccountToken,
  getAllAccounts,
  mergeMetrics,
} from "@/lib/github-accounts";
import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

export interface CategoryCount {
  category: string;
  count: number;
}

export interface DiscussionsMetrics {
  discussionsStarted: number;
  commentsLeft: number;
  commentsGiven: number;
  acceptedAnswers: number;
  markedAsAnswer: number;
  answeredRate: number;
  topCategories: CategoryCount[];
}

const DISCUSSIONS_QUERY = `
  query DiscussionsMetrics($from: DateTime!, $to: DateTime!) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        totalDiscussionContributions
        totalDiscussionCommentContributions
        totalDiscussionAnswerContributions
      }
      repositoryDiscussions(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          createdAt
          category {
            name
          }
        }
      }
    }
  }
`;

function getWindowDates(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchDiscussionsMetrics(
  token: string,
  days: number,
  cacheContext: { bypass: boolean; userId: string }
): Promise<DiscussionsMetrics> {
  const key = metricsCacheKey(cacheContext.userId, "discussions", { days });

  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.discussions,
    },
    async () => {
      if (token === "mock-token") {
        return {
          discussionsStarted: 12,
          commentsLeft: 28,
          commentsGiven: 28,
          acceptedAnswers: 5,
          markedAsAnswer: 5,
          answeredRate: 41.7,
          topCategories: [
            { category: "Q&A", count: 6 },
            { category: "Ideas", count: 4 },
            { category: "General", count: 2 },
          ],
        };
      }
      const { from, to } = getWindowDates(days);
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: DISCUSSIONS_QUERY,
          variables: { from, to },
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401) throw new GitHubAuthError();
        throw new Error("GitHub API error");
      }

      const data = (await response.json()) as {
        data?: {
          viewer?: {
            contributionsCollection?: {
              totalDiscussionContributions?: number | null;
              totalDiscussionCommentContributions?: number | null;
              totalDiscussionAnswerContributions?: number | null;
            } | null;
            repositoryDiscussions?: {
              nodes?: Array<{
                createdAt?: string | null;
                category?: {
                  name?: string | null;
                } | null;
              } | null> | null;
            } | null;
          } | null;
        };
      };

      const collection = data.data?.viewer?.contributionsCollection;
      const discussionsStarted = collection?.totalDiscussionContributions ?? 0;
      const acceptedAnswers = collection?.totalDiscussionAnswerContributions ?? 0;
      const commentsLeft = collection?.totalDiscussionCommentContributions ?? 0;

      const answeredRate =
        discussionsStarted > 0
          ? Math.round((acceptedAnswers / discussionsStarted) * 1000) / 10
          : 0;

      const categoryMap: Record<string, number> = {};
      const nodes = data.data?.viewer?.repositoryDiscussions?.nodes ?? [];
      const fromDate = new Date(from);

      for (const node of nodes) {
        if (!node) continue;
        const createdAt = node.createdAt ? new Date(node.createdAt) : null;
        if (!createdAt || createdAt < fromDate) continue;
        const catName = node.category?.name || "General";
        categoryMap[catName] = (categoryMap[catName] || 0) + 1;
      }

      const topCategories: CategoryCount[] = Object.entries(categoryMap)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return {
        discussionsStarted,
        commentsLeft,
        commentsGiven: commentsLeft,
        acceptedAnswers,
        markedAsAnswer: acceptedAnswers,
        answeredRate,
        topCategories,
      };
    }
  );
}

function mergeDiscussionMetrics(
  a: DiscussionsMetrics,
  b: DiscussionsMetrics
): DiscussionsMetrics {
  const discussionsStarted = a.discussionsStarted + b.discussionsStarted;
  const acceptedAnswers = a.acceptedAnswers + b.acceptedAnswers;
  const commentsLeft = a.commentsLeft + b.commentsLeft;
  const answeredRate =
    discussionsStarted > 0
      ? Math.round((acceptedAnswers / discussionsStarted) * 1000) / 10
      : 0;

  const categoryMap: Record<string, number> = {};
  for (const item of [...(a.topCategories || []), ...(b.topCategories || [])]) {
    categoryMap[item.category] = (categoryMap[item.category] || 0) + item.count;
  }
  const topCategories = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 3);

  return {
    discussionsStarted,
    commentsLeft,
    commentsGiven: commentsLeft,
    acceptedAnswers,
    markedAsAnswer: acceptedAnswers,
    answeredRate,
    topCategories,
  };
}

function formatDiscussionsMetrics(metrics: DiscussionsMetrics) {
  return metrics;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  const daysParam =
    req.nextUrl.searchParams.get("days") ||
    req.nextUrl.searchParams.get("range") ||
    req.nextUrl.searchParams.get("timeRange");
  let days = 30;
  if (daysParam) {
    const parsed = parseInt(daysParam.replace(/d$/, ""), 10);
    if (!isNaN(parsed) && [7, 30, 90].includes(parsed)) {
      days = parsed;
    }
  }

  if (!accountId) {
    try {
      const result = await fetchDiscussionsMetrics(session.accessToken, days, {
        bypass,
        userId: session.githubId ?? session.githubLogin ?? "primary",
      });
      return Response.json(formatDiscussionsMetrics(result));
    } catch (e) {
      if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  let targetAccountId = accountId;
  if (accountId.startsWith("org:")) {
    const parts = accountId.split(":");
    targetAccountId = parts[1];
  }

  if (!session.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (targetAccountId === "combined") {
    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accounts = await getAllAccounts(
      {
        token: session.accessToken,
        githubId: session.githubId,
        githubLogin: session.githubLogin,
      },
      userRow.id
    );

    const results = await Promise.allSettled(
      accounts.map((account) =>
        fetchDiscussionsMetrics(account.token, days, {
          bypass,
          userId: account.githubId,
        })
      )
    );

    const merged = mergeMetrics(results, mergeDiscussionMetrics);

    if (!merged) {
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }

    return Response.json(formatDiscussionsMetrics(merged));
  }

  let token: string | null = null;
  if (!userRow) {
    token = session.accessToken;
  } else {
    token =
      targetAccountId === session.githubId
        ? session.accessToken
        : await getAccountToken(userRow.id, targetAccountId);
  }

  if (!token) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const result = await fetchDiscussionsMetrics(token, days, {
      bypass,
      userId: targetAccountId === session.githubId ? session.githubId : targetAccountId,
    });
    return Response.json(formatDiscussionsMetrics(result));
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
