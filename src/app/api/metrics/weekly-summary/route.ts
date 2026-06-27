import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { GITHUB_API } from "@/lib/github";
import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";
import { isMetricsCacheBypassed, metricsCacheKey, withMetricsCache } from "@/lib/metrics-cache";
import { getAccountToken, getAllAccounts } from "@/lib/github-accounts";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { calculateStreak } from "@/lib/streak";
import { toDateStr } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

// Returns the start of the current week (Monday 00:00:00 UTC).
// All week boundary comparisons use UTC to stay consistent with GitHub's
// commit timestamps, which are always returned in UTC.
function getCurrentWeekStartUtc(): Date {
  const now = new Date();
  const currentWeekStart = new Date(now);
  const dayOfWeek = currentWeekStart.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - daysSinceMonday);
  currentWeekStart.setUTCHours(0, 0, 0, 0);
  return currentWeekStart;
}

function calculateCurrentStreak(activeDates: Set<string>): number {
  const { currentStreak } = calculateStreak(
    Array.from(activeDates).map((day) => new Date(day))
  );
  return currentStreak;
}

async function fetchActiveDates(githubLogin: string, token: string): Promise<Set<string>> {
  // Look back 90 days — the maximum window the GitHub Commit Search API supports.
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const activeDates = new Set<string>();
  let page = 1;

  // GitHub Commit Search API rate limits:
  //   • Authenticated (OAuth token / PAT): 30 requests/minute
  //   • Unauthenticated:                   10 requests/minute
  //
  // This loop pages up to 10 pages (1,000 commits max) to cover the 90-day window.
  // Each page = 1 request against the 30 req/min quota.
  // NOTE: this function is called INSIDE withMetricsCache in the GET handler,
  // so it only runs on a cache miss — repeated page loads reuse cached dates.
  while (true) {
    const searchRes = await fetch(
      `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${sinceStr}&per_page=100&page=${page}&sort=author-date&order=desc`,
      {
        headers: {
          // OAuth token / PAT: raises the Search API limit from 10 → 30 req/min.
          // Without this, the streak pagination loop could exhaust the unauthenticated
          // quota on its own, blocking all other Search API calls on the same IP.
          Authorization: `Bearer ${token}`,
          // Mandatory Accept header for the Commit Search endpoint.
          // Omitting it causes GitHub to return HTTP 415 (Unsupported Media Type).
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    // HTTP 401 = token revoked/invalid. HTTP 403 = rate limit.
    // Both throw so the outer GET handler can distinguish auth failures.
    if (!searchRes.ok) {
      if (searchRes.status === 401) throw new GitHubAuthError();
      throw new Error("GitHub API error");
    }

    const data = (await searchRes.json()) as { items: Array<{ commit: { author: { date: string } } }> };

    // Extract just the "YYYY-MM-DD" date from each commit timestamp.
    // Set deduplicates — multiple commits on the same day count as one active day.
    for (const item of data.items) {
      activeDates.add(item.commit.author.date.slice(0, 10));
    }

    // Stop when GitHub returns fewer than 100 items (last page) or the 10-page cap is hit.
    if (data.items.length < 100 || page >= 10) break;
    page++;
  }

  return activeDates;
}

interface WeeklySummaryData {
  commits: {
    current: number;
    previous: number;
    delta: number;
    trend: "up" | "down" | "same";
  };
  prs: {
    thisWeek: { opened: number; merged: number };
    lastWeek: { opened: number; merged: number };
  };
  issues: {
    thisWeek: { opened: number; closed: number };
    lastWeek: { opened: number; closed: number };
  };
  activeDays: {
    thisWeek: number;
    lastWeek: number;
  };
  streak: number;
  topRepo: string | null;
  repoBreakdown: { repoName: string; commits: number }[];
  dailyCommits: { date: string; commits: number }[];
  mostActiveDay: string | null;
}

async function fetchWeeklySummaryForAccount(
  token: string,
  githubLogin: string,
  userId: string,
  bypass: boolean
): Promise<WeeklySummaryData> {
  const key = metricsCacheKey(userId, "weekly-summary" as any);

  return withMetricsCache({ bypass, key, ttlSeconds: 5 * 60 }, async () => {
    const currentWeekStart = getCurrentWeekStartUtc();
    const prevWeekStart = new Date(currentWeekStart.getTime() - 7 * 86400000);
    const prevWeekEnd = new Date(currentWeekStart.getTime() - 1);
    // Fetch 14 days of data in a single query so both this week and last week
    // are covered with one Search API request instead of two.
    const fourteenDaysAgoStr = toDateStr(new Date(Date.now() - 14 * 86400000));

    // Search API call 1 of 3 — fetches commits for the past 14 days.
    const commitsRes = await fetch(
      `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${fourteenDaysAgoStr}&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    if (!commitsRes.ok && commitsRes.status === 401) throw new GitHubAuthError();
    const commitsData: {
      items: Array<{
        commit: { author: { date: string } };
        repository: { full_name: string };
      }>;
    } = commitsRes.ok
      ? await commitsRes.json()
      : { items: [] };

    let commitsThisWeek = 0;
    let commitsPrevWeek = 0;
    const activeDaysThisWeek = new Set<string>();
    const activeDaysLastWeek = new Set<string>();
    const repoCounts = new Map<string, number>();
    const recent7DaysMap = new Map<string, number>();
    
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    // Partition commits into this week vs last week using UTC week boundaries.
    for (const item of commitsData.items) {
      const commitDate = new Date(item.commit.author.date);
      const dateStr = item.commit.author.date.slice(0, 10);

      if (commitDate >= sevenDaysAgo) {
        recent7DaysMap.set(dateStr, (recent7DaysMap.get(dateStr) ?? 0) + 1);
      }

      if (commitDate >= currentWeekStart) {
        commitsThisWeek++;
        activeDaysThisWeek.add(dateStr);

        const repoName = item.repository.full_name;
        repoCounts.set(repoName, (repoCounts.get(repoName) ?? 0) + 1);
      } else if (commitDate >= prevWeekStart && commitDate <= prevWeekEnd) {
        commitsPrevWeek++;
        activeDaysLastWeek.add(dateStr);
      }
    }

    // Find the repo with the most commits this week — shown as "top repo" on the widget.
    let topRepo: string | null = null;
    let topRepoCount = 0;
    Array.from(repoCounts.entries()).forEach(([repoName, count]) => {
      if (count > topRepoCount) {
        topRepo = repoName;
        topRepoCount = count;
      }
    });

    // Search API call 2 of 3 — fetches PRs opened in the past 14 days.
    const prsRes = await fetch(
      `${GITHUB_API}/search/issues?q=type:pr+author:@me+created:>=${fourteenDaysAgoStr}&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    if (!prsRes.ok) {
      if (prsRes.status === 401) throw new GitHubAuthError();
      throw new Error("GitHub API error");
    }

    const prsData = (await prsRes.json()) as {
      items: Array<{
        created_at: string;
        state: string;
        pull_request?: { merged_at: string | null };
      }>;
    };

    let prsOpenedThisWeek = 0;
    let prsMergedThisWeek = 0;
    let prsOpenedLastWeek = 0;
    let prsMergedLastWeek = 0;

    // Partition PRs into this week vs last week, same boundary logic as commits.
    for (const item of prsData.items) {
      const createdAt = new Date(item.created_at);
      if (Number.isNaN(createdAt.getTime())) continue;
      if (createdAt >= currentWeekStart) {
        prsOpenedThisWeek++;
        if (item.pull_request?.merged_at != null) {
          prsMergedThisWeek++;
        }
      } else if (createdAt >= prevWeekStart && createdAt <= prevWeekEnd) {
        prsOpenedLastWeek++;
        if (item.pull_request?.merged_at != null) {
          prsMergedLastWeek++;
        }
      }
    }

    // Search API calls 3+ — fetchActiveDates pages through to build the 90-day commit date set.
    const streakDates = await fetchActiveDates(githubLogin, token);
    const commitDelta = commitsThisWeek - commitsPrevWeek;

    // Search API call 4 - fetches Issues opened in the past 14 days
    const issuesRes = await fetch(
      `${GITHUB_API}/search/issues?q=type:issue+author:@me+created:>=${fourteenDaysAgoStr}&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    if (!issuesRes.ok) {
      if (issuesRes.status === 401) throw new GitHubAuthError();
      throw new Error("GitHub API error");
    }

    const issuesData = (await issuesRes.json()) as {
      items: Array<{
        created_at: string;
        state: string;
        state_reason?: string | null;
      }>;
    };

    let issuesOpenedThisWeek = 0;
    let issuesClosedThisWeek = 0;
    let issuesOpenedLastWeek = 0;
    let issuesClosedLastWeek = 0;

    for (const item of issuesData.items) {
      const createdAt = new Date(item.created_at);
      if (Number.isNaN(createdAt.getTime())) continue;
      
      const isClosed = item.state === "closed" && item.state_reason === "completed";

      if (createdAt >= currentWeekStart) {
        issuesOpenedThisWeek++;
        if (isClosed) issuesClosedThisWeek++;
      } else if (createdAt >= prevWeekStart && createdAt <= prevWeekEnd) {
        issuesOpenedLastWeek++;
        if (isClosed) issuesClosedLastWeek++;
      }
    }

    const repoBreakdown = Array.from(repoCounts.entries())
      .map(([repoName, commits]) => ({ repoName, commits }))
      .sort((a, b) => b.commits - a.commits);

    const dailyCommits: { date: string; commits: number }[] = [];
    let mostActiveDay: string | null = null;
    let maxDailyCommits = -1;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const commits = recent7DaysMap.get(dateStr) ?? 0;
      dailyCommits.push({ date: dateStr, commits });

      if (commits > maxDailyCommits) {
        maxDailyCommits = commits;
        if (commits > 0) mostActiveDay = dateStr;
      }
    }

    return {
      commits: {
        current: commitsThisWeek,
        previous: commitsPrevWeek,
        delta: commitDelta,
        trend: commitDelta > 0 ? "up" : commitDelta < 0 ? "down" : "same",
      },
      prs: {
        thisWeek: { opened: prsOpenedThisWeek, merged: prsMergedThisWeek },
        lastWeek: { opened: prsOpenedLastWeek, merged: prsMergedLastWeek },
      },
      issues: {
        thisWeek: { opened: issuesOpenedThisWeek, closed: issuesClosedThisWeek },
        lastWeek: { opened: issuesOpenedLastWeek, closed: issuesClosedLastWeek },
      },
      activeDays: {
        thisWeek: activeDaysThisWeek.size,
        lastWeek: activeDaysLastWeek.size,
      },
      streak: calculateCurrentStreak(streakDates),
      topRepo,
      repoBreakdown,
      dailyCommits,
      mostActiveDay,
    };
  });
}

export async function GET(req: NextRequest) {
  // Session contains the GitHub OAuth token issued at sign-in.
  // Both accessToken and githubLogin are required for all API calls below.
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken || !session?.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session?.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  // If combined account view is requested
  if (accountId === "combined") {
    if (!session?.githubId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRow = await resolveAppUser(session?.githubId, session?.githubLogin);
    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const combinedKey = metricsCacheKey(userRow.id, "weekly-summary", { accountId: "combined" });
      
      const data = await withMetricsCache({ bypass, key: combinedKey, ttlSeconds: 5 * 60 }, async () => {
        const accounts = await getAllAccounts(
          {
            token: accessToken!,
            githubId: session?.githubId!,
            githubLogin: session?.githubLogin!,
          },
          userRow.id
        );

        const summaryPromises = accounts.map(async (acc) => {
          const token = acc.githubId === session?.githubId
            ? accessToken
            : await getAccountToken(userRow.id, acc.githubId);
          if (!token) return null;
          return fetchWeeklySummaryForAccount(token, acc.githubLogin, acc.githubId, bypass);
        });

        const resultsRaw = await Promise.allSettled(summaryPromises);
        const results = resultsRaw
          .filter((r): r is PromiseFulfilledResult<WeeklySummaryData> => r.status === "fulfilled" && r.value !== null)
          .map((r) => r.value);

        if (results.length === 0) {
          throw new Error("No account weekly summaries were successfully fetched");
        }

        // Merge the summaries
        const commitsCurrent = results.reduce((sum, r) => sum + r.commits.current, 0);
        const commitsPrevious = results.reduce((sum, r) => sum + r.commits.previous, 0);
        const commitsDelta = commitsCurrent - commitsPrevious;
        
        const prsThisWeekOpened = results.reduce((sum, r) => sum + r.prs.thisWeek.opened, 0);
        const prsThisWeekMerged = results.reduce((sum, r) => sum + r.prs.thisWeek.merged, 0);
        const prsLastWeekOpened = results.reduce((sum, r) => sum + r.prs.lastWeek.opened, 0);
        const prsLastWeekMerged = results.reduce((sum, r) => sum + r.prs.lastWeek.merged, 0);

        const issuesThisWeekOpened = results.reduce((sum, r) => sum + r.issues.thisWeek.opened, 0);
        const issuesThisWeekClosed = results.reduce((sum, r) => sum + r.issues.thisWeek.closed, 0);
        const issuesLastWeekOpened = results.reduce((sum, r) => sum + r.issues.lastWeek.opened, 0);
        const issuesLastWeekClosed = results.reduce((sum, r) => sum + r.issues.lastWeek.closed, 0);

        const activeDaysThisWeek = Math.min(7, results.reduce((sum, r) => sum + r.activeDays.thisWeek, 0));
        const activeDaysLastWeek = Math.min(7, results.reduce((sum, r) => sum + r.activeDays.lastWeek, 0));

        const maxStreak = Math.max(...results.map((r) => r.streak));

        // Find the top repository by commits count
        let topRepo: string | null = null;
        let highestCommits = -1;
        for (const res of results) {
          if (res.topRepo && res.commits.current > highestCommits) {
            topRepo = res.topRepo;
            highestCommits = res.commits.current;
          }
        }

        const repoBreakdownMap = new Map<string, number>();
        for (const res of results) {
          for (const repo of res.repoBreakdown) {
            repoBreakdownMap.set(repo.repoName, (repoBreakdownMap.get(repo.repoName) ?? 0) + repo.commits);
          }
        }
        const combinedRepoBreakdown = Array.from(repoBreakdownMap.entries())
          .map(([repoName, commits]) => ({ repoName, commits }))
          .sort((a, b) => b.commits - a.commits);
        
        const dailyCommitsMap = new Map<string, number>();
        for (const res of results) {
          for (const day of res.dailyCommits) {
            dailyCommitsMap.set(day.date, (dailyCommitsMap.get(day.date) ?? 0) + day.commits);
          }
        }
        
        const combinedDailyCommits: { date: string; commits: number }[] = [];
        let mostActiveDay: string | null = null;
        let maxCommitsForDay = -1;
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          const commits = dailyCommitsMap.get(dateStr) ?? 0;
          combinedDailyCommits.push({ date: dateStr, commits });
          if (commits > maxCommitsForDay) {
            maxCommitsForDay = commits;
            if (commits > 0) mostActiveDay = dateStr;
          }
        }

        return {
          commits: {
            current: commitsCurrent,
            previous: commitsPrevious,
            delta: commitsDelta,
            trend: commitsDelta > 0 ? "up" : commitsDelta < 0 ? "down" : "same",
          },
          prs: {
            thisWeek: { opened: prsThisWeekOpened, merged: prsThisWeekMerged },
            lastWeek: { opened: prsLastWeekOpened, merged: prsLastWeekMerged },
          },
          issues: {
            thisWeek: { opened: issuesThisWeekOpened, closed: issuesThisWeekClosed },
            lastWeek: { opened: issuesLastWeekOpened, closed: issuesLastWeekClosed },
          },
          activeDays: {
            thisWeek: activeDaysThisWeek,
            lastWeek: activeDaysLastWeek,
          },
          streak: maxStreak,
          topRepo,
          repoBreakdown: combinedRepoBreakdown,
          dailyCommits: combinedDailyCommits,
          mostActiveDay,
        };
      });

      return Response.json(data);
    } catch (e) {
      if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  let token = accessToken;
  let githubLogin = session?.githubLogin;
  let userId = session?.githubId ?? session?.githubLogin;

  if (accountId && accountId !== session?.githubId) {
    if (!session?.githubId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRow = await resolveAppUser(session?.githubId, session?.githubLogin);
    if (!userRow) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    token = accountToken;
    githubLogin = accountRow.github_login;
    userId = accountId;
  }

  try {
    const data = await fetchWeeklySummaryForAccount(token, githubLogin, userId, bypass);
    return Response.json(data);
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
