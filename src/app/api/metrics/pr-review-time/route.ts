import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import {
  getAccountToken,
  getAllAccounts,
  mergeMetrics,
} from "@/lib/github-accounts";
import { GITHUB_API, GitHubAuthError } from "@/lib/github";
import { githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

interface PullRequestSearchItem {
  created_at: string;
  pull_request?: { merged_at: string | null };
}

interface TrendWeek {
  weekStart: string;
  label: string;
  avgReviewDays: number | null;
  mergedCount: number;
  totalDays: number;
}

interface TrendBucket {
  totalDays: number;
  mergedCount: number;
}

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getUtcWeekStart(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  result.setUTCHours(0, 0, 0, 0);

  return result;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(start: Date): string {
  const end = addDaysUtc(start, 6);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return `${startLabel} - ${endLabel}`;
}

function buildTrendWeeks(): TrendWeek[] {
  const currentWeekStart = getUtcWeekStart(new Date());
  const oldestWeekStart = addDaysUtc(currentWeekStart, -11 * 7);

  return Array.from({ length: 12 }, (_, index) => {
    const weekStart = addDaysUtc(oldestWeekStart, index * 7);

    return {
      weekStart: toDateKey(weekStart),
      label: formatWeekLabel(weekStart),
      avgReviewDays: null,
      mergedCount: 0,
      totalDays: 0,
    };
  });
}

function emptyTrend(): TrendWeek[] {
  return buildTrendWeeks();
}

async function fetchPRReviewTrendForAccount(
  token: string,
  cacheContext: { bypass: boolean; userId: string }
): Promise<TrendWeek[]> {
  const key = metricsCacheKey(cacheContext.userId, "pr-review-time", {
    weeks: 12,
  });

  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.prs,
    },
    async () => {
      const trendWeeks = emptyTrend();
      const bucketMap = new Map<string, TrendBucket>(
        trendWeeks.map((week) => [week.weekStart, { totalDays: 0, mergedCount: 0 }])
      );

      const oldestWeekStart = new Date(`${trendWeeks[0].weekStart}T00:00:00.000Z`);
      const since = oldestWeekStart.toISOString().slice(0, 10);

      const mergedRes = await fetch(
        `${GITHUB_API}/search/issues?q=type:pr+author:@me+merged:>=${since}&sort=updated&order=desc&per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }
      );

      if (!mergedRes.ok) {
        if (mergedRes.status === 401) throw new GitHubAuthError();
        throw new Error("GitHub API error");
      }

      const data = (await mergedRes.json()) as {
        items: PullRequestSearchItem[];
      };

      for (const pr of data.items) {
        const mergedAt = pr.pull_request?.merged_at;

        if (!mergedAt) {
          continue;
        }

        const openedAt = new Date(pr.created_at).getTime();
        const mergedAtMs = new Date(mergedAt).getTime();

        if (
          Number.isNaN(openedAt) ||
          Number.isNaN(mergedAtMs) ||
          mergedAtMs < openedAt
        ) {
          continue;
        }

        const weekStart = getUtcWeekStart(new Date(mergedAt));
        const weekKey = toDateKey(weekStart);
        const bucket = bucketMap.get(weekKey);

        if (!bucket) {
          continue;
        }

        bucket.totalDays += (mergedAtMs - openedAt) / 86400000;
        bucket.mergedCount += 1;
      }

      return trendWeeks.map((week) => {
        const bucket = bucketMap.get(week.weekStart);
        const avgReviewDays =
          bucket && bucket.mergedCount > 0
            ? Math.round((bucket.totalDays / bucket.mergedCount) * 100) / 100
            : null;

        return {
          ...week,
          avgReviewDays,
          mergedCount: bucket?.mergedCount ?? 0,
          totalDays: bucket?.totalDays ?? 0,
        };
      });
    }
  );
}

function mergeTrendWeeks(a: TrendWeek[], b: TrendWeek[]): TrendWeek[] {
  const bucketMap = new Map<string, TrendBucket>(
    a.map((week) => [week.weekStart, { totalDays: 0, mergedCount: 0 }])
  );

  for (const week of a) {
    const bucket = bucketMap.get(week.weekStart);
    if (!bucket || week.avgReviewDays === null || week.mergedCount === 0) {
      continue;
    }

    bucket.totalDays += week.totalDays;
    bucket.mergedCount += week.mergedCount;
  }

  for (const week of b) {
    const bucket = bucketMap.get(week.weekStart);
    if (!bucket || week.avgReviewDays === null || week.mergedCount === 0) {
      continue;
    }

    bucket.totalDays += week.totalDays;
    bucket.mergedCount += week.mergedCount;
  }

  return a.map((week) => {
    const bucket = bucketMap.get(week.weekStart);

    return {
      ...week,
      avgReviewDays:
        bucket && bucket.mergedCount > 0
          ? Math.round((bucket.totalDays / bucket.mergedCount) * 100) / 100
          : null,
      mergedCount: bucket?.mergedCount ?? 0,
      totalDays: bucket?.totalDays ?? 0,
    };
  });
}

function formatTrendWeeks(weeks: TrendWeek[]) {
  return { weeks };
}

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();

  if (!sessionData) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = sessionData.session;
  const accessToken = sessionData.accessToken;

  if (session.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }
  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  if (!accountId) {
    try {
      const result = await fetchPRReviewTrendForAccount(accessToken, {
        bypass,
        userId: session.githubId ?? session.githubLogin ?? "primary",
      });

      return Response.json(formatTrendWeeks(result));
    } catch (e) {
      if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  if (!session.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (!userRow) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (accountId === "combined") {
    const accounts = await getAllAccounts(
      {
        token: accessToken,
        githubId: session.githubId,
        githubLogin: session.githubLogin,
      },
      userRow.id
    );

    const results = await Promise.allSettled(
      accounts.map((account) =>
        fetchPRReviewTrendForAccount(account.token, {
          bypass,
          userId: account.githubId,
        })
      )
    );

    const merged = mergeMetrics(results, mergeTrendWeeks);

    if (!merged) {
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }

    return Response.json(formatTrendWeeks(merged));
  }

  const token =
    accountId === session.githubId
      ? accessToken
      : await getAccountToken(userRow.id, accountId);

  if (!token) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const result = await fetchPRReviewTrendForAccount(token, {
      bypass,
      userId: accountId === session.githubId ? session.githubId : accountId,
    });

    return Response.json(formatTrendWeeks(result));
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}