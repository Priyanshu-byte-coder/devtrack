import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import {
  getAccountToken,
  getAllAccounts,
} from "@/lib/github-accounts";
import { GITHUB_API } from "@/lib/github";
import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import {
  summarizeCodingActivity,
  type CodingActivityInsight,
} from "@/lib/coding-activity-insights";

export const dynamic = "force-dynamic";

interface CommitSearchItem {
  commit: {
    author: {
      date: string;
    };
  };
}

const SEARCH_WINDOW_DAYS = 90;

function getRequestedTimeZone(req: NextRequest): string {
  const raw = req.nextUrl.searchParams.get("timeZone")?.trim();
  if (!raw) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw }).format(new Date());
    return raw;
  } catch (e) {
    return "UTC";
  }
}

async function fetchCommitTimestampsForAccount(
  token: string,
  githubLogin: string,
  cacheContext: { bypass: boolean; userId: string }
): Promise<string[]> {
  const key = metricsCacheKey(cacheContext.userId, "coding-activity-insights", {
    githubLogin,
    days: SEARCH_WINDOW_DAYS,
  });

  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS["coding-activity-insights"],
    },
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - SEARCH_WINDOW_DAYS);
      const sinceStr = since.toISOString().slice(0, 10);

      const timestamps: string[] = [];
      let totalCount = 0;
      let page = 1;

      while (page <= 10) {
        const response = await fetch(
          `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${sinceStr}&per_page=100&page=${page}&sort=author-date&order=desc`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          if (response.status === 401) throw new GitHubAuthError();
          if ((response.status === 403 || response.status === 429) && timestamps.length > 0) {
            break;
          }

          throw new Error("GitHub API error");
        }

        const payload = (await response.json()) as {
          total_count: number;
          items: CommitSearchItem[];
        };

        if (page === 1) {
          totalCount = payload.total_count;
        }

        timestamps.push(
          ...payload.items
            .map((item) => item.commit?.author?.date)
            .filter((date): date is string => Boolean(date))
        );

        if (payload.items.length < 100) {
          break;
        }

        if (timestamps.length >= 1000 || timestamps.length >= totalCount) {
          break;
        }

        page += 1;
      }

      return timestamps;
    }
  );
}

async function buildInsightsForAccount(
  token: string,
  githubLogin: string,
  timeZone: string,
  cacheContext: { bypass: boolean; userId: string }
): Promise<CodingActivityInsight> {
  const timestamps = await fetchCommitTimestampsForAccount(
    token,
    githubLogin,
    cacheContext
  );

  return summarizeCodingActivity(timestamps, timeZone);
}

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();

  if (!sessionData || !sessionData.session.githubLogin || !sessionData.session.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = sessionData.session;
  const accessToken = sessionData.accessToken;
  const githubLogin = session.githubLogin as string;
  const githubId = session.githubId as string;

  if (session.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  const timeZone = getRequestedTimeZone(req);
  const bypass = isMetricsCacheBypassed(req);

  if (!accountId) {
    try {
      const data = await buildInsightsForAccount(
        accessToken,
        githubLogin,
        timeZone,
        { bypass, userId: githubId }
      );

      return Response.json(data);
    } catch (e) {
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  const userRow = await resolveAppUser(githubId, githubLogin);
  if (!userRow) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (accountId === "combined") {
      const accounts = await getAllAccounts(
        {
          token: accessToken,
          githubId,
          githubLogin,
        },
        userRow.id
      );

      const results = await Promise.allSettled(
        accounts.map((account) =>
          fetchCommitTimestampsForAccount(account.token, account.githubLogin, {
            bypass,
            userId: account.githubId,
          })
        )
      );

      const fulfilled = results
        .filter(
          (result): result is PromiseFulfilledResult<string[]> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);

      if (fulfilled.length === 0) {
        return Response.json({ error: "GitHub API error" }, { status: 502 });
      }

      const timestamps = fulfilled.flat();
      const data = summarizeCodingActivity(timestamps, timeZone);
      return Response.json(data);
    }

    if (accountId === githubId) {
      const data = await buildInsightsForAccount(
        accessToken,
        githubLogin,
        timeZone,
        { bypass, userId: githubId }
      );

      return Response.json(data);
    }

    const token = await getAccountToken(userRow.id, accountId);
    if (!token) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const { data: accountRow } = await supabaseAdmin
      .from("user_github_accounts")
      .select("github_login")
      .eq("user_id", userRow.id)
      .eq("github_id", accountId)
      .single();

    if (!accountRow?.github_login) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    const data = await buildInsightsForAccount(token, accountRow.github_login, timeZone, {
      bypass,
      userId: accountId,
    });

    return Response.json(data);
  } catch (e) {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}