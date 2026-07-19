import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  getAccountToken,
  getAllAccounts,
  mergeMetrics,
} from "@/lib/github-accounts";
import { GITHUB_API, GitHubCommitSearchItem, GitHubAuthError } from "@/lib/github";
import { githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

export interface HourlyCell {
  day: number;
  hour: number;
  count: number;
  avg: number;
}

export interface ProductiveHoursResponse {
  grid: HourlyCell[];
  peak: HourlyCell | null;
  total: number;
  days: number;
  timezone: string;
}

async function fetchProductiveHoursForAccount(
  token: string,
  githubLogin: string,
  days: number,
  timezone: string,
  cacheContext: { bypass: boolean; userId: string },
  fromDate?: string,
  repo?: string | null
): Promise<ProductiveHoursResponse> {
  const repoFilter = repo ? ` repo:${repo}` : "";

  const key = metricsCacheKey(cacheContext.userId, "productive-hours", {
    days,
    githubLogin,
    timezone,
    from: fromDate ?? undefined,
    repo,
  });

  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS["productive-hours"], // reuse the same TTL
    },
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = fromDate ?? toLocalDateStr(since);

      let allItems: GitHubCommitSearchItem[] = [];
      let totalCount = 0;
      let page = 1;

      // Paginate GitHub commit search — mirrors contributions/route.ts exactly.
      // Up to 10 pages × 100 items = 1 000 commits max.
      while (page <= 10) {
        const searchUrl = new URL(`${GITHUB_API}/search/commits`);
        searchUrl.searchParams.set(
          "q",
          `author:${githubLogin} author-date:>=${sinceStr}${repoFilter}`
        );
        searchUrl.searchParams.set("per_page", "100");
        searchUrl.searchParams.set("page", String(page));
        searchUrl.searchParams.set("sort", "author-date");
        searchUrl.searchParams.set("order", "desc");

        const searchRes = await fetch(searchUrl.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        });

        if (!searchRes.ok) {
          if (searchRes.status === 401) throw new GitHubAuthError();
          // Graceful degradation on rate-limit — return partial data already collected.
          if (searchRes.status === 429 || searchRes.status === 403) {
            if (allItems.length === 0) {
              throw new Error(`GitHub API error: ${searchRes.status}`);
            }
            break;
          }
          throw new Error("GitHub API error");
        }

        const data = (await searchRes.json()) as {
          total_count: number;
          items: GitHubCommitSearchItem[];
        };

        if (page === 1) {
          totalCount = data.total_count;
        }

        allItems = allItems.concat(data.items);

        if (
          data.items.length < 100 ||
          allItems.length >= 1000 ||
          allItems.length >= totalCount
        ) {
          break;
        }

        page += 1;
      }

      const counts: Record<string, number> = {};

      for (const item of allItems) {
        const utcDate = new Date(item.commit.author.date);

        const localDate = new Date(
          utcDate.toLocaleString("en-US", { timeZone: timezone })
        );

        const day = localDate.getDay();   // 0 Sun … 6 Sat
        const hour = localDate.getHours(); // 0–23
        const k = `${day}-${hour}`;
        counts[k] = (counts[k] ?? 0) + 1;
      }

      return buildResponse(counts, totalCount, days, timezone);
    }
  );
}

function mergeProductiveHours(
  a: ProductiveHoursResponse,
  b: ProductiveHoursResponse
): ProductiveHoursResponse {
  const counts: Record<string, number> = {};

  for (const cell of [...a.grid, ...b.grid]) {
    const k = `${cell.day}-${cell.hour}`;
    counts[k] = (counts[k] ?? 0) + cell.count;
  }

  return buildResponse(
    counts,
    a.total + b.total,
    Math.max(a.days, b.days),
    a.timezone
  );
}

function buildResponse(
  counts: Record<string, number>,
  total: number,
  days: number,
  timezone: string
): ProductiveHoursResponse {
  const weeks = Math.max(Math.ceil(days / 7), 1);

  const grid: HourlyCell[] = [];
  let peak: HourlyCell | null = null;

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = counts[`${day}-${hour}`] ?? 0;
      const avg = parseFloat((count / weeks).toFixed(2));
      const cell: HourlyCell = { day, hour, count, avg };
      grid.push(cell);

      if (count > 0 && (!peak || avg > peak.avg)) {
        peak = cell;
      }
    }
  }

  return { grid, peak, total, days, timezone };
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const searchParams = req.nextUrl.searchParams;

  const timezone = sanitizeTimezone(searchParams.get("tz") ?? "UTC");

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const repoParam = searchParams.get("repo");

  let days: number;
  let fromDate: string | undefined;

  if (fromParam && toParam) {
    fromDate = fromParam;
    const msPerDay = 1000 * 60 * 60 * 24;
    days =
      Math.ceil(
        (new Date(toParam).getTime() - new Date(fromParam).getTime()) / msPerDay
      ) + 1;
  } else {
    const daysParam = searchParams.get("days");
    const parsedDays = daysParam ? parseInt(daysParam, 10) : NaN;
    days = isNaN(parsedDays) ? 90 : Math.max(1, Math.min(365, parsedDays));
  }

  const accountId = searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  if (!accountId) {
    try {
      const result = await fetchProductiveHoursForAccount(
        session.accessToken,
        session.githubLogin,
        days,
        timezone,
        { bypass, userId: session.githubId ?? session.githubLogin },
        fromDate,
        repoParam
      );
      return Response.json(result);
    } catch (e) {
      if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  if (!session.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (!userRow) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (accountId === "combined") {
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
        fetchProductiveHoursForAccount(
          account.token,
          account.githubLogin,
          days,
          timezone,
          { bypass, userId: account.githubId },
          fromDate,
          repoParam
        )
      )
    );

    const merged = mergeMetrics(results, mergeProductiveHours);

    if (!merged) {
      return Response.json({ error: "All accounts failed" }, { status: 502 });
    }

    return Response.json(merged);
  }

  if (accountId === session.githubId) {
    try {
      const result = await fetchProductiveHoursForAccount(
        session.accessToken,
        session.githubLogin,
        days,
        timezone,
        { bypass, userId: session.githubId },
        fromDate,
        repoParam
      );
      return Response.json(result);
    } catch (e) {
      if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  const accountToken = await getAccountToken(userRow.id, accountId);

  if (!accountToken) {
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

  try {
    const result = await fetchProductiveHoursForAccount(
      accountToken,
      accountRow.github_login,
      days,
      timezone,
      { bypass, userId: accountId },
      fromDate,
      repoParam
    );
    return Response.json(result);
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}

function sanitizeTimezone(tz: string): string {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}