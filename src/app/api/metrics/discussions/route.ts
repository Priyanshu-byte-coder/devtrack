import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
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

interface DiscussionsMetrics {
  discussionsStarted: number;
  acceptedAnswers: number;
  commentsPosted: number;
}

const DISCUSSIONS_QUERY = `
  query DiscussionsMetrics($from: DateTime!, $to: DateTime!) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        totalDiscussionContributions
        totalDiscussionCommentContributions
        totalDiscussionAnswerContributions
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
          discussionsStarted: 5,
          acceptedAnswers: 2,
          commentsPosted: 14,
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
          } | null;
        };
      };

      const collection = data.data?.viewer?.contributionsCollection;

      return {
        discussionsStarted: collection?.totalDiscussionContributions ?? 0,
        acceptedAnswers: collection?.totalDiscussionAnswerContributions ?? 0,
        commentsPosted: collection?.totalDiscussionCommentContributions ?? 0,
      };
    }
  );
}

function mergeDiscussionMetrics(
  a: DiscussionsMetrics,
  b: DiscussionsMetrics
): DiscussionsMetrics {
  return {
    discussionsStarted: a.discussionsStarted + b.discussionsStarted,
    acceptedAnswers: a.acceptedAnswers + b.acceptedAnswers,
    commentsPosted: a.commentsPosted + b.commentsPosted,
  };
}

function formatDiscussionsMetrics(metrics: DiscussionsMetrics) {
  return metrics;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);
  const days = 30;

  if (!accountId) {
    try {
      const result = await fetchDiscussionsMetrics(accessToken, days, {
        bypass,
        userId: session?.githubId ?? session?.githubLogin ?? "primary",
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

  if (!session?.githubId || !session?.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRow = await resolveAppUser(session?.githubId, session?.githubLogin);

  if (targetAccountId === "combined") {
    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accounts = await getAllAccounts(
      {
        token: accessToken,
        githubId: session?.githubId,
        githubLogin: session?.githubLogin,
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
    token = accessToken;
  } else {
    token =
      targetAccountId === session?.githubId
        ? accessToken
        : await getAccountToken(userRow.id, targetAccountId);
  }

  if (!token) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const result = await fetchDiscussionsMetrics(token, days, {
      bypass,
      userId: targetAccountId === session?.githubId ? session?.githubId : targetAccountId,
    });
    return Response.json(formatDiscussionsMetrics(result));
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
