import {
  githubRateLimitResponse,
  throwIfGitHubRateLimited,
} from "@/lib/github-rate-limit";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  getAccountToken,
  getAllAccounts,
  mergeMetrics,
} from "@/lib/github-accounts";
import { orgSearchSegment } from "@/lib/github-orgs";
import { GITHUB_API, GitHubCommitSearchItem, CommitItem } from "@/lib/github";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { resolveAppUser } from "@/lib/resolve-user";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { logError } from "@/lib/error-handler";
// ─── GitHub API Rate Limiting ──────────────────────────────────────────────────
// Unauthenticated requests: 60 req/hr (shared per IP).
// Authenticated requests (OAuth token or PAT): 5,000 req/hr per user.
// GitHub Search API has an extra secondary limit: ~30 req/min when authenticated.
//
// This route always sends the user's GitHub OAuth token in the Authorization
// header (from NextAuth session), ensuring the 5,000 req/hr limit applies.
// Users can also add a PAT in settings for the same higher limit.
//
// Rate limit errors: GitHub returns HTTP 403 (primary limit) or HTTP 429
// (secondary/search limit). The X-RateLimit-Remaining: 0 response header
// confirms quota exhaustion. The user sees "GitHub API error" in the dashboard.
// ──────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

interface TimeBlocks {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
}

interface ContributionResponse {
  days: number;
  total: number;
  data: Record<string, number>;
  commits: CommitItem[];
  timeBlocks: TimeBlocks;
  sources?: {
    github: Record<string, number>;
    gitlab?: Record<string, number>;
  };
}

interface GitLabEvent {
  created_at: string;
  push_data?: {
    commit_count?: number;
  };
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateInTimezone(dateString: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateString));
}

function getHourInTimezone(dateString: string, timezone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(dateString));

  return Number(hour);
}

function mergeContributionDays(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const result = { ...a };
  for (const [date, count] of Object.entries(b)) {
    result[date] = (result[date] ?? 0) + count;
  }
  return result;
}

function sumContributionDays(data: Record<string, number>): number {
  return Object.values(data).reduce((total, count) => total + count, 0);
}

function githubApiErrorResponse(error: unknown): Response {
  const rateLimitResponse = githubRateLimitResponse(error);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return Response.json({ error: "GitHub API error" }, { status: 502 });
}

async function fetchContributionsForAccount(
  token: string,
  githubLogin: string,
  days: number,
  cacheContext: { bypass: boolean; userId: string },
  timezone: string,
  fromDate?: string,
  repo?: string | null,
  orgName?: string | null,
  excludedOrgs: string[] = []
): Promise<ContributionResponse> {
  const repoFilter = repo ? ` repo:${repo}` : "";

  const key = metricsCacheKey(cacheContext.userId, "contributions", {
    days,
    githubLogin,
    timezone,
    from: fromDate ?? undefined,
    repo,
    orgName: orgName || undefined,
    excludedOrgs: excludedOrgs.length > 0 ? excludedOrgs.join(",") : undefined,
  });

  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.contributions,
    },
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = fromDate ?? toLocalDateStr(since);

      let allItems: GitHubCommitSearchItem[] = [];
      const commitItems: CommitItem[] = [];
      let totalCount = 0;
      let page = 1;

      let q = `author:${githubLogin} author-date:>=${sinceStr}${repoFilter}`;
      if (orgName) {
        q += ` org:${orgName}`;
      } else if (excludedOrgs.length > 0) {
        q += excludedOrgs.map((org) => ` -org:${org}`).join("");
      }

      // Note: this may issue up to 10 sequential GitHub Search API calls (max 1000 results).
      // Authenticated GitHub Search rate limits are low (~30 req/min). We handle 429/403
      // responses gracefully by returning partial results rather than failing the endpoint.
      while (page <= 10) {
        const searchUrl = new URL(`${GITHUB_API}/search/commits`);
        searchUrl.searchParams.set("q", q);
        searchUrl.searchParams.set("per_page", "100");
        searchUrl.searchParams.set("page", String(page));
        searchUrl.searchParams.set("sort", "author-date");
        searchUrl.searchParams.set("order", "desc");

        // The Authorization header upgrades the rate limit from 60 req/hr
        // (unauthenticated, shared per IP) to 5,000 req/hr (per user).
        // Without it, multiple users on the same server IP would exhaust
        // the shared quota almost immediately.
        // Authorization header raises the rate limit from 60 req/hr (unauthenticated,
        // shared per IP) to 5,000 req/hr per user. Without it, shared server IPs
        // would exhaust the unauthenticated quota almost immediately.
        const searchRes = await fetch(
          searchUrl.toString(),
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          }
        );

        if (!searchRes.ok) {
  throwIfGitHubRateLimited(searchRes);

  if (searchRes.status === 429 || searchRes.status === 403) {
    if (allItems.length === 0) {
      throw new Error(`GitHub API error: ${searchRes.status}`);
    }

    break;
  }

  throw new Error(`GitHub API error: ${searchRes.status}`);
}

        const data = (await searchRes.json()) as {
          total_count: number;
          items: GitHubCommitSearchItem[];
        };

        if (page === 1) {
          totalCount = data.total_count;
        }

        allItems = allItems.concat(data.items);

        if (data.items.length < 100) {
          break;
        }

        if (allItems.length >= 1000 || allItems.length >= totalCount) {
          break;
        }

        page += 1;
      }

      const commitsByDay: Record<string, number> = {};
      const timeBlocks: TimeBlocks = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      for (const item of allItems) {

        const date = getDateInTimezone(item.commit.author.date, timezone);
        commitsByDay[date] = (commitsByDay[date] ?? 0) + 1;
        commitItems.push({
          sha: item.sha,
          message: item.commit.message.split("\n")[0],
          date,
          repo: item.repository?.full_name ?? "unknown",
          url: item.html_url,
        });

        const hour = getHourInTimezone(item.commit.author.date, timezone);
        if (hour >= 6 && hour < 12) timeBlocks.morning++;
        else if (hour >= 12 && hour < 18) timeBlocks.afternoon++;
        else if (hour >= 18 && hour < 22) timeBlocks.evening++;
        else timeBlocks.night++;
      }

      return { days, total: totalCount, data: commitsByDay, commits: commitItems, timeBlocks };
    }
  );
}

async function fetchGitLabContributions(
  token: string,
  days: number,
  cacheContext: { bypass: boolean; userId: string }
): Promise<ContributionResponse> {
  const key = metricsCacheKey(cacheContext.userId, "contributions", {
    days,
    source: "gitlab",
  });

  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.contributions,
    },
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      const MAX_PAGES = 10;
      let page = 1;
      const commitsByDay: Record<string, number> = {};

      while (page > 0 && page <= MAX_PAGES) {
        const url = new URL("https://gitlab.com/api/v4/events");
        url.searchParams.set("action", "pushed");
        url.searchParams.set("per_page", "100");
        url.searchParams.set("page", String(page));

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("GitLab API error");
        }

        const events = (await response.json()) as GitLabEvent[];
        if (events.length === 0) break;

        let reachedCutoff = false;
        for (const event of events) {
          const eventDate = new Date(event.created_at);
          if (eventDate < since) {
            reachedCutoff = true;
            break;
          }

          const count = event.push_data?.commit_count ?? 0;
          if (!count) continue;

          const dateKey = event.created_at.slice(0, 10);
          commitsByDay[dateKey] = (commitsByDay[dateKey] ?? 0) + count;
        }

        if (reachedCutoff) break;

        const nextPage = response.headers.get("x-next-page");
        if (!nextPage || nextPage === "0") break;
        const parsedNext = Number(nextPage);
        page = Number.isFinite(parsedNext) ? parsedNext : 0;
      }

      return {
        days,
        total: sumContributionDays(commitsByDay),
        data: commitsByDay,
        commits: [],
        timeBlocks: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      };
    }
  );
}

async function mergeGitLabContributions(
  result: ContributionResponse,
  token: string,
  days: number,
  cacheContext: { bypass: boolean; userId: string }
): Promise<ContributionResponse> {
  const gitlabResult = await fetchGitLabContributions(
    token,
    days,
    cacheContext
  ).catch(() => null);

  if (!gitlabResult) {
    return result;
  }

  const combinedData = mergeContributionDays(result.data, gitlabResult.data);
  const combinedTotal = result.total + sumContributionDays(gitlabResult.data);

  return {
    days: result.days,
    total: combinedTotal,
    data: combinedData,
    commits: result.commits,
    timeBlocks: result.timeBlocks,
    sources: {
      github: result.data,
      gitlab: gitlabResult.data,
    },
  };
}

export async function GET(req: NextRequest) {
  const timezone = req.nextUrl.searchParams.get("timezone") || "UTC";
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const repoParam = req.nextUrl.searchParams.get("repo");

  let days: number;
  let fromDate: string | undefined;

  if (fromParam && toParam) {
    fromDate = fromParam;
    const msPerDay = 1000 * 60 * 60 * 24;
    days = Math.ceil(
      (new Date(toParam).getTime() - new Date(fromParam).getTime()) / msPerDay
    ) + 1;
  } else {
    const daysParam = req.nextUrl.searchParams.get("days");
    const parsedDays = daysParam ? parseInt(daysParam, 10) : NaN;
    days = isNaN(parsedDays) ? 30 : Math.max(1, Math.min(365, parsedDays));
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  const usernameParam = req.nextUrl.searchParams.get("username");
  const username = usernameParam ? normalizeGitHubUsername(usernameParam) : null;
  const bypass = isMetricsCacheBypassed(req);
  const gitlabToken =
    typeof session.gitlabToken === "string" ? session.gitlabToken : undefined;

  if (usernameParam && !username) {
    return Response.json({ error: "Invalid GitHub username" }, { status: 400 });
  }

  // Compare mode path: explicitly fetch contributions for a target username.
  let orgName: string | null = null;
  let targetAccountId: string | null = accountId;

  if (accountId && accountId.startsWith("org:")) {
    const parts = accountId.split(":");
    targetAccountId = parts[1];
    orgName = parts[2];
    if (!targetAccountId || !orgName) {
      return Response.json({ error: "Invalid organization account ID" }, { status: 400 });
    }
  }

  // Load excluded organizations config
  let excludedOrgs: string[] = [];
  if (isSupabaseAdminAvailable && session.githubId) {
    try {
      const { data: dbUser } = await supabaseAdmin
        .from("users")
        .select("organizations_config")
        .eq("github_id", session.githubId)
        .single();

      const orgsConfig = (dbUser?.organizations_config || {}) as Record<string, boolean>;
      excludedOrgs = Object.entries(orgsConfig)
        .filter(([_, enabled]) => enabled === false)
        .map(([org]) => org);
    } catch (error) {
      logError(error, {
        endpoint: "/api/metrics/contributions",
        operation: "loadExcludedOrgsConfig",
      });
    }
  }

  // Compare mode path: explicitly fetch contributions for a target username.
  if (username) {
    try {
      const result = await fetchContributionsForAccount(
        session.accessToken,
        username,
        days,
        { bypass, userId: session.githubId ?? session.githubLogin },
        timezone,
        fromDate,
        repoParam,
        orgName,
        excludedOrgs
      );
      return Response.json(result);
  } catch (error) {
    return githubApiErrorResponse(error);
  }
  }

  if (!targetAccountId) {
    try {
      const result = await fetchContributionsForAccount(
        session.accessToken,
        session.githubLogin,
        days,
        { bypass, userId: session.githubId ?? session.githubLogin },
        timezone,
        fromDate,
        repoParam,
        orgName,
        excludedOrgs
      );

      if (!gitlabToken) {
        return Response.json(result);
      }

      const merged = await mergeGitLabContributions(result, gitlabToken, days, {
        bypass,
        userId: session.githubId ?? session.githubLogin,
      });

      return Response.json(merged);
    } catch (error) {
      return githubApiErrorResponse(error);
    }
  }

  if (!session.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (!userRow) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (targetAccountId === "combined") {
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
        fetchContributionsForAccount(
          account.token,
          account.githubLogin,
          days,
          { bypass, userId: account.githubId },
          timezone,
          fromDate,
          repoParam,
          orgName,
          excludedOrgs
        )
      )
    );


    const rateLimitedResult = results.find(
  (result): result is PromiseRejectedResult =>
    result.status === "rejected" &&
    githubRateLimitResponse(result.reason) !== null
);

if (rateLimitedResult) {
  return githubApiErrorResponse(rateLimitedResult.reason);
}

    const merged = mergeMetrics(results, (a, b) => ({
      days: a.days,
      total: a.total + b.total,
      data: mergeContributionDays(a.data, b.data),
      commits: [...a.commits, ...b.commits].sort(
        (c, d) => d.date.localeCompare(c.date) || d.sha.localeCompare(c.sha)
      ),
      timeBlocks: {
        morning: a.timeBlocks.morning + b.timeBlocks.morning,
        afternoon: a.timeBlocks.afternoon + b.timeBlocks.afternoon,
        evening: a.timeBlocks.evening + b.timeBlocks.evening,
        night: a.timeBlocks.night + b.timeBlocks.night,
      },
    }));

    if (!merged) {
      return Response.json({ error: "All accounts failed" }, { status: 502 });
    }

    if (!gitlabToken) {
      return Response.json(merged);
    }

    const combined = await mergeGitLabContributions(merged, gitlabToken, days, {
      bypass,
      userId: session.githubId,
    });

    return Response.json(combined);
  }

  if (targetAccountId === session.githubId) {
    try {
      const result = await fetchContributionsForAccount(
        session.accessToken,
        session.githubLogin,
        days,
        { bypass, userId: session.githubId },
        timezone,
        fromDate,
        repoParam,
        orgName,
        excludedOrgs
      );

      if (!gitlabToken) {
        return Response.json(result);
      }

      const merged = await mergeGitLabContributions(result, gitlabToken, days, {
        bypass,
        userId: session.githubId,
      });

      return Response.json(merged);
    } catch (error) {
      return githubApiErrorResponse(error);
    }
  }

  const accountToken = await getAccountToken(userRow.id, targetAccountId);

  if (!accountToken) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  const { data: accountRow } = await supabaseAdmin
    .from("user_github_accounts")
    .select("github_login")
    .eq("user_id", userRow.id)
    .eq("github_id", targetAccountId)
    .single();

  if (!accountRow?.github_login) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const result = await fetchContributionsForAccount(
      accountToken,
      accountRow.github_login,
      days,
      { bypass, userId: targetAccountId },
      timezone,
      fromDate,
      repoParam,
      orgName,
      excludedOrgs
    );
    return Response.json(result);
  } catch (error) {
    return githubApiErrorResponse(error);
  }
}