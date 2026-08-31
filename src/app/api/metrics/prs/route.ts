import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAccountToken, getAllAccounts } from "@/lib/github-accounts";
import { GITHUB_API } from "@/lib/github";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { resolveAppUser, type AppUser } from "@/lib/resolve-user";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface PRMetricsBase {
  open: number;
  merged: number;
  closed: number;
  total: number;
  totalAdditions: number;
  totalDeletions: number;
  avgReviewHours: number;
  avgFirstReviewHours: number | null;
  mergeRate: number;
  avgCycleTime: number;
  weeklyTrend: { week: string; avgHours: number }[];
  slowestRepos: { repo: string; avgHours: number }[];
}

interface ReviewMetrics {
  totalReviews: number;
  approvalRate: string;
  avgFirstReviewHours: number | null;
  topRepos: { repo: string; count: number }[];
}

function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const week = Math.floor(date.getDate() / 7) + 1;
  return `${date.toLocaleString("default", { month: "short" })} W${week}`;
}

interface PullRequestSearchItem {
  state: string;
  created_at: string;
  closed_at: string | null;
  number: number;
  repository_url: string;
  pull_request?: { merged_at: string | null };
}

interface ReviewEvent {
  submitted_at?: string | null;
}

interface ReviewCommentEvent {
  created_at?: string | null;
}

interface GraphQLPullRequestNode {
  createdAt: string;
  additions: number;
  deletions: number;
  reviews: {
    nodes: { submittedAt: string }[];
  };
  repository: { nameWithOwner: string };
}

interface GraphQLSearchResponse {
  data?: {
    search?: {
      nodes?: GraphQLPullRequestNode[];
    };
  };
}

interface GitLabMergeRequestItem {
  state: string;
  created_at: string;
  merged_at?: string | null;
  closed_at?: string | null;
}

function getRepoFullName(repositoryUrl: string): string | null {
  const marker = "/repos/";
  const index = repositoryUrl.indexOf(marker);
  return index >= 0 ? repositoryUrl.slice(index + marker.length) : null;
}

function getEarliestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  return timestamps.length > 0 ? Math.min(...timestamps) : null;
}

async function fetchFirstReviewTimestamp(
  token: string,
  pr: PullRequestSearchItem
): Promise<number | null> {
  const repo = getRepoFullName(pr.repository_url);
  if (!repo) return null;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  const [reviewsRes, commentsRes] = await Promise.all([
    fetch(`${GITHUB_API}/repos/${repo}/pulls/${pr.number}/reviews?per_page=100`, { headers, cache: "no-store" }),
    fetch(`${GITHUB_API}/repos/${repo}/pulls/${pr.number}/comments?per_page=100`, { headers, cache: "no-store" }),
  ]);

  if (!reviewsRes.ok || !commentsRes.ok) return null;

  const reviews = (await reviewsRes.json()) as ReviewEvent[];
  const comments = (await commentsRes.json()) as ReviewCommentEvent[];

  return getEarliestTimestamp([
    ...reviews.map((review) => review.submitted_at),
    ...comments.map((comment) => comment.created_at),
  ]);
}

const FIRST_REVIEW_SAMPLE_SIZE = 10;
const CONCURRENCY_BATCH = 5;

async function getAverageFirstReviewHours(
  token: string,
  prs: PullRequestSearchItem[]
): Promise<number | null> {
  const sample = prs.slice(0, FIRST_REVIEW_SAMPLE_SIZE);
  const results: (number | null)[] = [];

  for (let i = 0; i < sample.length; i += CONCURRENCY_BATCH) {
    const batch = sample.slice(i, i + CONCURRENCY_BATCH);
    const batchResults = await Promise.all(
      batch.map(async (pr) => {
        const firstReviewAt = await fetchFirstReviewTimestamp(token, pr);
        if (!firstReviewAt) return null;

        const openedAt = new Date(pr.created_at).getTime();
        if (Number.isNaN(openedAt) || firstReviewAt < openedAt) return null;

        return (firstReviewAt - openedAt) / 3600000;
      })
    );
    results.push(...batchResults);
  }

  const validDurations = results.filter((value): value is number => typeof value === "number");
  if (validDurations.length === 0) return null;

  const average = validDurations.reduce((sum, value) => sum + value, 0) / validDurations.length;
  return Math.round(average * 10) / 10;
}

async function fetchPRMetrics(
  token: string,
  githubLogin?: string,
  orgName?: string | null,
  excludedOrgs: string[] = [],
  range: string = "30d"
): Promise<PRMetricsBase> {
  const authorQ = githubLogin ? githubLogin : "@me";
  let q = `type:pr+author:${authorQ}`;
  const days =
    range === "7d" ? 7 :
      range === "90d" ? 90 :
        30;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const searchSince = cutoff.toISOString().split("T")[0];

  q += `+created:>=${searchSince}`;
  if (orgName) {
    q += `+org:${orgName}`;
  } else if (excludedOrgs.length > 0) {
    q += excludedOrgs.map((org) => `+-org:${org}`).join("");
  }
  const searchRes = await fetch(
    `${GITHUB_API}/search/issues?q=${q}&sort=updated&order=desc&per_page=100`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  if (!searchRes.ok) throw new Error("GitHub API error");

  const data = (await searchRes.json()) as {
    total_count: number;
    items: PullRequestSearchItem[];
  };

  const open = data.items.filter((pr) => pr.state === "open").length;
  const mergedPRs = data.items.filter((pr) => pr.pull_request?.merged_at != null);
  const merged = mergedPRs.length;
  const closed = data.items.filter((pr) => pr.state === "closed" && pr.pull_request?.merged_at == null).length;

  const avgReviewMs = mergedPRs.length > 0
    ? mergedPRs.reduce((sum, pr) => sum + (new Date(pr.closed_at!).getTime() - new Date(pr.created_at).getTime()), 0) / mergedPRs.length
    : 0;

  const sampleTotal = data.items.length;
  const avgFirstReviewHours = await getAverageFirstReviewHours(token, data.items);

  // GraphQL for review cycle time
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const since = sinceDate.toISOString().split("T")[0];

  const gqlAuthorQ = githubLogin ? githubLogin : "@me";
  let gqlSearchQ = `type:pr reviewed-by:${gqlAuthorQ}`;
  if (orgName) {
    gqlSearchQ += ` org:${orgName}`;
  } else if (excludedOrgs.length > 0) {
    gqlSearchQ += excludedOrgs.map((org) => ` -org:${org}`).join("");
  }
  gqlSearchQ += ` created:>${since}`;

  const query = `
    query($queryString: String!) {
      search(query: $queryString, type: ISSUE, first: 100) {
        nodes {
          ... on PullRequest {
            createdAt
            additions
            deletions
            reviews(first: 1) { nodes { submittedAt } }
            repository { nameWithOwner }
          }
        }
      }
    }
  `;

  const gqlRes = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { queryString: gqlSearchQ } }),
    cache: "no-store",
  });

  const gqlJson = (await gqlRes.json()) as GraphQLSearchResponse;
  const prs = gqlJson.data?.search?.nodes ?? [];
  const totalAdditions = prs.reduce(
    (sum, pr) => sum + (pr.additions || 0),
    0
  );

  const totalDeletions = prs.reduce(
    (sum, pr) => sum + (pr.deletions || 0),
    0
  );

  const reviewedPRs = prs.filter((pr) => pr.reviews?.nodes && pr.reviews.nodes.length > 0);

  const cycleTimes = reviewedPRs.map((pr) => ({
    hours: Math.round((new Date(pr.reviews.nodes[0].submittedAt).getTime() - new Date(pr.createdAt).getTime()) / 3600000),
    week: getWeekLabel(pr.createdAt),
    repo: pr.repository.nameWithOwner,
  }));

  const avgCycleTime = cycleTimes.length > 0
    ? Math.round(cycleTimes.reduce((sum, ct) => sum + ct.hours, 0) / cycleTimes.length)
    : 0;

  const weeklyMap: Record<string, number[]> = {};
  cycleTimes.forEach((ct) => {
    if (!weeklyMap[ct.week]) weeklyMap[ct.week] = [];
    weeklyMap[ct.week].push(ct.hours);
  });

  const weeklyTrend = Object.entries(weeklyMap).map(([week, times]) => ({
    week,
    avgHours: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
  }));

  const repoMap: Record<string, number[]> = {};
  cycleTimes.forEach((ct) => {
    if (!repoMap[ct.repo]) repoMap[ct.repo] = [];
    repoMap[ct.repo].push(ct.hours);
  });

  const slowestRepos = Object.entries(repoMap)
    .map(([repo, times]) => ({ repo, avgHours: Math.round(times.reduce((a, b) => a + b, 0) / times.length) }))
    .sort((a, b) => b.avgHours - a.avgHours)
    .slice(0, 3);

  return {
    open,
    merged,
    closed,
    total: data.total_count,
    totalAdditions,
    totalDeletions,
    avgReviewHours: Math.round(avgReviewMs / 3600000),
    avgFirstReviewHours,
    mergeRate: sampleTotal > 0 ? merged / sampleTotal : 0,
    avgCycleTime,
    weeklyTrend,
    slowestRepos,
  };
}

async function fetchGitLabMRMetrics(token: string): Promise<PRMetricsBase> {
  const perPage = 100;
  let page = 1;
  let totalPages: number | null = null;
  let totalCount: number | null = null;
  const items: GitLabMergeRequestItem[] = [];

  while (page > 0) {
    const url = new URL("https://gitlab.com/api/v4/merge_requests");
    url.searchParams.set("scope", "created_by_me");
    url.searchParams.set("state", "all");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) throw new Error("GitLab API error");

    if (totalCount === null) {
      const totalHeader = response.headers.get("x-total");
      const parsedTotal = totalHeader ? Number(totalHeader) : NaN;
      if (Number.isFinite(parsedTotal)) totalCount = parsedTotal;
    }

    if (totalPages === null) {
      const totalPagesHeader = response.headers.get("x-total-pages");
      const parsedPages = totalPagesHeader ? Number(totalPagesHeader) : NaN;
      if (Number.isFinite(parsedPages) && parsedPages > 0) totalPages = parsedPages;
    }

    const pageItems = (await response.json()) as GitLabMergeRequestItem[];
    if (!Array.isArray(pageItems) || pageItems.length === 0) break;

    items.push(...pageItems);

    const nextPage = response.headers.get("x-next-page");
    const parsedNext = nextPage && nextPage !== "0" ? Number(nextPage) : NaN;
    if (Number.isFinite(parsedNext)) {
      page = parsedNext;
      continue;
    }

    if (totalPages !== null && page < totalPages) {
      page += 1;
      continue;
    }

    if (pageItems.length === perPage) {
      page += 1;
      continue;
    }
    break;
  }

  const open = items.filter((mr) => mr.state === "opened").length;
  const mergedItems = items.filter((mr) => mr.state === "merged" && mr.merged_at);
  const merged = mergedItems.length;
  const closed = items.filter((mr) => mr.state === "closed").length;

  const reviewDurations = mergedItems
    .map((mr) => {
      const created = new Date(mr.created_at).getTime();
      const mergedAt = new Date(mr.merged_at!).getTime();
      if (Number.isNaN(created) || Number.isNaN(mergedAt)) return null;
      return mergedAt - created;
    })
    .filter((value): value is number => typeof value === "number");

  const avgReviewMs = reviewDurations.length > 0
    ? reviewDurations.reduce((sum, value) => sum + value, 0) / reviewDurations.length
    : 0;

  const sampleTotal = items.length;

  return {
    open,
    merged,
    closed,
    total: totalCount ?? sampleTotal,
    totalAdditions: 0,
    totalDeletions: 0,
    avgReviewHours: Math.round(avgReviewMs / 3600000),
    avgFirstReviewHours: null,
    mergeRate: sampleTotal > 0 ? merged / sampleTotal : 0,
    avgCycleTime: 0,
    weeklyTrend: [],
    slowestRepos: [],
  };
}

async function fetchCachedPRMetrics(
  token: string,
  cacheContext: { bypass: boolean; userId: string; staleThresholdDays?: number },
  githubLogin?: string,
  orgName?: string | null,
  excludedOrgs: string[] = [],
  range: string = "30d"
): Promise<PRMetricsBase> {
  const key = metricsCacheKey(cacheContext.userId, "prs", {
    range,
    staleThresholdDays: cacheContext.staleThresholdDays ?? 14,
    githubLogin,
    orgName: orgName || undefined,
    excludedOrgs: excludedOrgs.length > 0 ? excludedOrgs.join(",") : undefined,
  });

  return withMetricsCache(
    { bypass: cacheContext.bypass, key, ttlSeconds: METRICS_CACHE_TTL_SECONDS.prs },
    () => fetchPRMetrics(token, githubLogin, orgName, excludedOrgs, range)
  );
}

async function fetchCachedGitLabMRMetrics(
  token: string,
  cacheContext: { bypass: boolean; userId: string }
): Promise<PRMetricsBase> {
  const key = metricsCacheKey(cacheContext.userId, "prs", { source: "gitlab" });

  return withMetricsCache(
    { bypass: cacheContext.bypass, key, ttlSeconds: METRICS_CACHE_TTL_SECONDS.prs },
    () => fetchGitLabMRMetrics(token)
  );
}

function formatPRMetrics(metrics: PRMetricsBase) {
  return {
    open: metrics.open,
    merged: metrics.merged,
    closed: metrics.closed,
    total: metrics.total,
    avgReviewHours: metrics.avgReviewHours,
    avgFirstReviewHours: metrics.avgFirstReviewHours,
    mergeRate: metrics.total > 0 ? `${Math.round(metrics.mergeRate * 100)}%` : "0%",
    avgCycleTime: metrics.avgCycleTime,
    weeklyTrend: metrics.weeklyTrend,
    slowestRepos: metrics.slowestRepos,
    totalAdditions: metrics.totalAdditions,
    totalDeletions: metrics.totalDeletions,
  };
}

function formatPRMetricsResponse(metrics: PRMetricsBase, gitlab: PRMetricsBase | null) {
  return {
    ...formatPRMetrics(metrics),
    ...(gitlab ? { gitlab: formatPRMetrics(gitlab) } : {}),
  };
}

async function getGitLabMetrics(token: string | undefined, cacheContext: { bypass: boolean; userId: string }) {
  if (!token) return null;
  try {
    return await fetchCachedGitLabMRMetrics(token, cacheContext);
  } catch (e) {
    return null;
  }
}

async function fetchReviewMetrics(token: string): Promise<ReviewMetrics> {
  const query = `
    query {
      viewer {
        contributionsCollection {
          pullRequestReviewContributions(first: 100) {
            nodes {
              occurredAt
              pullRequestReview {
                state
                pullRequest { repository { nameWithOwner } }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error("GitHub GraphQL error");

  const json = await res.json();
  const nodes = json?.data?.viewer?.contributionsCollection?.pullRequestReviewContributions?.nodes ?? [];

  const totalReviews = nodes.length;
  const approvals = nodes.filter(
    (n: { pullRequestReview: { state: string } }) => n.pullRequestReview?.state === "APPROVED"
  ).length;

  const approvalRate = totalReviews > 0 ? `${Math.round((approvals / totalReviews) * 100)}%` : "0%";

  const repoCounts: Record<string, number> = {};
  for (const node of nodes) {
    const repo = node.pullRequestReview?.pullRequest?.repository?.nameWithOwner;
    if (repo) repoCounts[repo] = (repoCounts[repo] ?? 0) + 1;
  }

  const topRepos = Object.entries(repoCounts)
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalReviews,
    approvalRate,
    avgFirstReviewHours: null,
    topRepos,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gitlabToken = typeof session.gitlabToken === "string" ? session.gitlabToken : undefined;
  const accountId = req.nextUrl.searchParams.get("accountId");
  const range = req.nextUrl.searchParams.get("range") || "30d";
  const bypass = isMetricsCacheBypassed(req);

  const gitlabCacheContext = {
    bypass,
    userId: session.githubId ?? session.githubLogin ?? "primary",
  };

  let orgName: string | null = null;
  let targetAccountId: string | null = accountId;

  if (accountId && accountId.startsWith("org:")) {
    const parts = accountId.split(":");
    targetAccountId = parts[1];
    orgName = parts[2];
  }

  // Load excluded organizations config
  let excludedOrgs: string[] = [];
  let userRow: AppUser | null = null;
  if (isSupabaseAdminAvailable && session.githubId) {
    userRow = await resolveAppUser(session.githubId, session.githubLogin);
    if (userRow) {
      try {
        const { data: dbUser } = await supabaseAdmin
          .from("users")
          .select("organizations_config")
          .eq("id", userRow.id)
          .single();

        const orgsConfig = (dbUser?.organizations_config || {}) as Record<string, boolean>;
        excludedOrgs = Object.entries(orgsConfig)
          .filter(([_, enabled]) => enabled === false)
          .map(([org]) => org);
      } catch (err) {
        console.error("Failed to load excluded orgs config:", err);
      }
    }
  }

  if (!targetAccountId) {
    try {
      const result = await fetchCachedPRMetrics(
        session.accessToken,
        {
          bypass,
          userId: session.githubId ?? session.githubLogin ?? "primary",
        },
        session.githubLogin,
        orgName,
        excludedOrgs,
        range
      );

      const [gitlab, reviews] = await Promise.all([
        getGitLabMetrics(gitlabToken, gitlabCacheContext),
        fetchReviewMetrics(session.accessToken).catch(() => null),
      ]);

      return Response.json({ ...formatPRMetricsResponse(result, gitlab), reviews });
    } catch {
      // Catches errors from fetchCachedPRMetrics (GitHub Search API failures).
      // Returns 502 so the client knows the data is unavailable, not just empty.
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  if (!session.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userRow) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (targetAccountId === "combined") {
    try {
      const allAccounts = await getAllAccounts(
        { token: session.accessToken!, githubId: session.githubId, githubLogin: session.githubLogin },
        userRow.id
      );

      const metricsPromises = allAccounts.map(async (acc) => {
        const token = acc.githubId === session.githubId
          ? session.accessToken
          : await getAccountToken(userRow.id, acc.githubId);
        if (!token) return null;
        return fetchCachedPRMetrics(token, { bypass, userId: acc.githubId }, acc.githubLogin, orgName, excludedOrgs, range);
      });

      const resultsRaw = await Promise.allSettled(metricsPromises);
      const results = resultsRaw
        .filter((r): r is PromiseFulfilledResult<PRMetricsBase> => r.status === "fulfilled" && r.value !== null)
        .map(r => r.value);

      if (results.length === 0) {
        return Response.json({ error: "No accounts found" }, { status: 404 });
      }

      const combinedTotal = results.reduce((sum, r) => sum + r.total, 0);
      const combinedMerged = results.reduce((sum, r) => sum + r.merged, 0);
      const combinedClosed = results.reduce((sum, r) => sum + r.closed, 0);
      const combinedOpen = results.reduce((sum, r) => sum + r.open, 0);

      const avgReviewHours = combinedTotal > 0
        ? results.reduce((sum, r) => sum + (r.avgReviewHours * r.total), 0) / combinedTotal
        : 0;

      const reviewedTotal = results.reduce((sum, r) => sum + (r.avgFirstReviewHours === null ? 0 : r.total), 0);
      const avgFirstReviewHours = reviewedTotal > 0
        ? results.reduce((sum, r) => sum + ((r.avgFirstReviewHours ?? 0) * r.total), 0) / reviewedTotal
        : null;

      const combinedCycleTime = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.avgCycleTime, 0) / results.length)
        : 0;

      const weeklyTrendsMap: Record<string, number[]> = {};
      results.forEach(r => {
        r.weeklyTrend.forEach(wt => {
          if (!weeklyTrendsMap[wt.week]) weeklyTrendsMap[wt.week] = [];
          weeklyTrendsMap[wt.week].push(wt.avgHours);
        });
      });

      const combinedWeeklyTrend = Object.entries(weeklyTrendsMap).map(([week, hoursArray]) => ({
        week,
        avgHours: Math.round(hoursArray.reduce((a, b) => a + b, 0) / hoursArray.length)
      }));

      const combinedSlowest = results
        .flatMap(r => r.slowestRepos)
        .sort((a, b) => b.avgHours - a.avgHours)
        .slice(0, 3);

      const combinedMetrics: PRMetricsBase = {
        totalAdditions: results.reduce(
          (sum, r) => sum + r.totalAdditions,
          0
        ),

        totalDeletions: results.reduce(
          (sum, r) => sum + r.totalDeletions,
          0
        ),
        open: combinedOpen,
        merged: combinedMerged,
        closed: combinedClosed,
        total: combinedTotal,
        avgReviewHours: Math.round(avgReviewHours * 10) / 10,
        avgFirstReviewHours: avgFirstReviewHours === null ? null : Math.round(avgFirstReviewHours * 10) / 10,
        mergeRate: combinedTotal > 0 ? combinedMerged / combinedTotal : 0,
        avgCycleTime: combinedCycleTime,
        weeklyTrend: combinedWeeklyTrend,
        slowestRepos: combinedSlowest
      };

      const [gitlab, reviews] = await Promise.all([
        getGitLabMetrics(gitlabToken, gitlabCacheContext),
        fetchReviewMetrics(session.accessToken).catch(() => null),
      ]);

      return Response.json({ ...formatPRMetricsResponse(combinedMetrics, gitlab), reviews });
    } catch {
      return Response.json({ error: "Failed to compile combined profile metrics" }, { status: 502 });
    }
  }

  const token = !targetAccountId || targetAccountId === session.githubId
    ? session.accessToken
    : await getAccountToken(userRow.id, targetAccountId);

  if (!token) return Response.json({ error: "Account not found" }, { status: 404 });

  const { data: accountRow } = await supabaseAdmin
    .from("user_github_accounts")
    .select("github_login")
    .eq("user_id", userRow.id)
    .eq("github_id", targetAccountId)
    .single();

  const githubLogin = targetAccountId === session.githubId ? session.githubLogin : accountRow?.github_login;

  if (!githubLogin) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const result = await fetchCachedPRMetrics(
      token,
      {
        bypass,
        userId: targetAccountId === session.githubId ? session.githubId : targetAccountId,
      },
      githubLogin,
      orgName,
      excludedOrgs,
      range
    );

    const [gitlab, reviews] = await Promise.all([
      getGitLabMetrics(gitlabToken, gitlabCacheContext),
      fetchReviewMetrics(session.accessToken).catch(() => null),
    ]);

    return Response.json({ ...formatPRMetricsResponse(result, gitlab), reviews });
  } catch (e) {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
