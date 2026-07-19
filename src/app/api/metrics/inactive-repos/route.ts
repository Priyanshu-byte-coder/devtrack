import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { getAccountToken, getAllAccounts, mergeMetrics } from "@/lib/github-accounts";
import { fetchUserRepos, GitHubAuthError, type GitHubRepo } from "@/lib/github";
import { githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { resolveAppUser } from "@/lib/resolve-user";
import { supabaseAdmin } from "@/lib/supabase";
import type { InactiveRepo, InactiveReposResponse, RepoVisibility } from "@/types/inactive-repos";

export const dynamic = "force-dynamic";

const ALLOWED_THRESHOLDS = new Set([30, 60, 90]);

function parseThreshold(value: string | null): number {
  const parsed = Number.parseInt(value ?? "30", 10);
  return ALLOWED_THRESHOLDS.has(parsed) ? parsed : 30;
}

function getVisibility(repo: GitHubRepo): RepoVisibility {
  if (repo.visibility === "public" || repo.visibility === "private" || repo.visibility === "internal") {
    return repo.visibility;
  }

  return repo.private ? "private" : "public";
}

function getLastActiveAt(repo: GitHubRepo): string | null {
  return repo.pushed_at ?? repo.updated_at ?? null;
}

function formatInactiveRepo(repo: GitHubRepo, thresholdDays: number): InactiveRepo | null {
  const lastActiveAt = getLastActiveAt(repo);

  if (!lastActiveAt) {
    return null;
  }

  const activityDate = new Date(lastActiveAt);

  if (Number.isNaN(activityDate.getTime())) {
    return null;
  }

  const inactiveDays = Math.floor((Date.now() - activityDate.getTime()) / 86400000);

  if (inactiveDays < thresholdDays) {
    return null;
  }

  return {
    name: repo.full_name,
    lastActiveAt: activityDate.toISOString(),
    inactiveDays,
    visibility: getVisibility(repo),
    url: repo.html_url,
  };
}

function sortInactiveRepos(repos: InactiveRepo[]): InactiveRepo[] {
  return [...repos].sort((a, b) => {
    if (b.inactiveDays !== a.inactiveDays) {
      return b.inactiveDays - a.inactiveDays;
    }

    return new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime();
  });
}

function mergeInactiveRepoLists(a: InactiveRepo[], b: InactiveRepo[]): InactiveRepo[] {
  const map = new Map<string, InactiveRepo>();

  for (const repo of [...a, ...b]) {
    const existing = map.get(repo.name);

    if (!existing) {
      map.set(repo.name, repo);
      continue;
    }

    const currentTime = new Date(repo.lastActiveAt).getTime();
    const existingTime = new Date(existing.lastActiveAt).getTime();

    if (repo.inactiveDays > existing.inactiveDays || (repo.inactiveDays === existing.inactiveDays && currentTime < existingTime)) {
      map.set(repo.name, repo);
    }
  }

  return sortInactiveRepos(Array.from(map.values()));
}

async function fetchInactiveReposForAccount(
  token: string,
  githubLogin: string,
  thresholdDays: number,
  cacheContext: { bypass: boolean; userId: string }
): Promise<InactiveReposResponse> {
  const key = metricsCacheKey(cacheContext.userId, "inactive-repos", {
    thresholdDays,
    githubLogin,
  });

  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS["inactive-repos"],
    },
    async () => {
      const repos = await fetchUserRepos(token);
      const inactiveRepos = repos
        .map((repo) => formatInactiveRepo(repo, thresholdDays))
        .filter((repo): repo is InactiveRepo => repo !== null);

      return {
        repos: sortInactiveRepos(inactiveRepos),
        thresholdDays,
      };
    }
  );
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

  const thresholdDays = parseThreshold(req.nextUrl.searchParams.get("days"));
  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  if (!accountId) {
    try {
      const result = await fetchInactiveReposForAccount(
        accessToken,
        githubLogin,
        thresholdDays,
        { bypass, userId: githubId }
      );

      return Response.json(result);
    } catch (e) {
      if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  const userRow = await resolveAppUser(githubId, githubLogin);

  if (!userRow) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        fetchInactiveReposForAccount(account.token, account.githubLogin, thresholdDays, {
          bypass,
          userId: account.githubId,
        })
      )
    );

    const merged = mergeMetrics(results, (a, b) => ({
      thresholdDays: a.thresholdDays,
      repos: mergeInactiveRepoLists(a.repos, b.repos),
    }));

    if (!merged) {
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }

    return Response.json(merged);
  }

  if (accountId === githubId) {
    try {
      const result = await fetchInactiveReposForAccount(
        accessToken,
        githubLogin,
        thresholdDays,
        { bypass, userId: githubId }
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
    const result = await fetchInactiveReposForAccount(
      accountToken,
      accountRow.github_login,
      thresholdDays,
      { bypass, userId: accountId }
    );

    return Response.json(result);
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}