import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  getAccountToken,
  getAllAccounts,
  mergeMetrics,
} from "@/lib/github-accounts";
import { GITHUB_API } from "@/lib/github";
import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

interface RepoSummary {
  name: string;
  commits: number;
  description: string | null;
  url: string;
  languages?: RepoLanguage[];
}

interface RepoLanguage {
  name: string;
  bytes: number;
  percentage: number;
}

interface RepoResponse {
  repos: RepoSummary[];
  days: number;
}

function mergeRepoCommits(
  a: Array<RepoSummary>,
  b: Array<RepoSummary>
): Array<RepoSummary> {
  // Merges repo commit counts across multiple GitHub accounts for the "combined" view.
  // If both accounts committed to the same repo, their counts are summed.
  const map = new Map<string, { commits: number; description: string | null; url: string; languages?: RepoLanguage[] }>();
  for (const repo of [...a, ...b]) {
    const existing = map.get(repo.name);
    map.set(repo.name, {
      commits: (existing?.commits ?? 0) + repo.commits,
      description: existing?.description ?? repo.description,
      url: existing?.url ?? repo.url,
      languages: existing?.languages ?? repo.languages,
    });
  }
  return Array.from(map.entries())
    .map(([name, { commits, description, url, languages }]) => ({
      name,
      commits,
      description,
      url,
      languages,
    }))
    .sort((x, y) => y.commits - x.commits);
}

async function fetchRepoLanguages(
  token: string,
  repoName: string
): Promise<RepoLanguage[]> {
  // GitHub REST API — NOT the Search API, so it uses the higher quota:
  //   • Authenticated (OAuth token / PAT): 5,000 requests/hour
  //   • Unauthenticated:                      60 requests/hour
  //
  // This is called once per top repo (up to 6 calls per fetchReposForAccount).
  // At 5,000/hr that is negligible for a single account, but for the "combined"
  // multi-account view this multiplies: N accounts × 6 repos = N×6 REST requests.
  const res = await fetch(`${GITHUB_API}/repos/${repoName}/languages`, {
    headers: {
      // OAuth token / PAT: keeps requests in the 5,000/hr authenticated tier.
      // Without this, 60 req/hr unauthenticated would be exhausted almost immediately.
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });

  // Silently return empty array on any failure (rate limit, private repo access
  // denied, network error) — language data is decorative and should not prevent
  // the repos widget from rendering if this secondary call fails.
  if (!res.ok) {
    return [];
  }

  const langs = (await res.json()) as Record<string, number>;
  const totalBytes = Object.values(langs).reduce((sum, bytes) => sum + bytes, 0);

  if (totalBytes <= 0) {
    return [];
  }

  return Object.entries(langs)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: Math.round((bytes / totalBytes) * 1000) / 10,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 6);
}

async function fetchReposForAccount(
  token: string,
  githubLogin: string,
  days: number,
  cacheContext: { bypass: boolean; userId: string },
  orgName?: string | null,
  excludedOrgs: string[] = []
): Promise<RepoResponse> {
  // Cache key is scoped per user + githubLogin + days so different time range
  // selections and multi-account views don't return each other's cached results.
  const key = metricsCacheKey(cacheContext.userId, "repos", {
    days,
    githubLogin,
    orgName: orgName || undefined,
    excludedOrgs: excludedOrgs.length > 0 ? excludedOrgs.join(",") : undefined,
  });

  // withMetricsCache returns cached results within the TTL window, skipping all
  // GitHub API calls below. This is the primary protection against exhausting
  // the Search API's 30 req/min rate limit on repeated dashboard loads.
  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS.repos,
    },
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().slice(0, 10); // "YYYY-MM-DD"

      let q = `author:${githubLogin}`;
      if (orgName) {
        q += `+org:${orgName}`;
      } else if (excludedOrgs.length > 0) {
        q += excludedOrgs.map((org) => `+-org:${org}`).join("");
      }
      q += `+author-date:>=${sinceStr}`;

      // GitHub Commit Search API — finds all commits by this user in the date window.
      // Rate limits (separate and stricter than the REST API):
      //   • Authenticated (OAuth token / PAT): 30 requests/minute
      //   • Unauthenticated:                   10 requests/minute
      //
      // We fetch a single page of 100 commits — enough to identify the top 6 repos
      // by commit count. The withMetricsCache wrapper above prevents re-fetching
      // within the TTL, so this Search API request is only made on a cache miss.
      const searchRes = await fetch(
        `${GITHUB_API}/search/commits?q=${q}&per_page=100&sort=author-date&order=desc`,
        {
          headers: {
            // OAuth token / PAT: raises the Search API limit from 10 → 30 req/min.
            // For the "combined" multi-account view, this is called once per linked
            // account — e.g. 3 accounts = 3 Search API requests in parallel, each
            // drawing from that account token's own 30 req/min quota.
            Authorization: `Bearer ${token}`,
            // The Accept header is mandatory for the Commit Search endpoint.
            // Omitting it causes GitHub to return HTTP 415 (Unsupported Media Type).
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }
      );

      // HTTP 401 = token revoked — throw auth error so caller can surface reconnect.
      // HTTP 403 = Search API rate limit exceeded for this token.
      // HTTP 422 = malformed query (e.g. invalid date format or username characters).
      if (!searchRes.ok) {
        if (searchRes.status === 401) throw new GitHubAuthError();
        throw new Error("GitHub API error");
      }

      const data = (await searchRes.json()) as {
        items: Array<{
          repository: { full_name: string; html_url: string; description: string | null };
          commit: { author: { date: string } };
        }>;
      };

      // Group commits by repository and count them.
      // Each item in the Search API response represents one commit, so we tally
      // per repo to find the most actively committed-to repositories.
      const repoMap: Record<string, { commits: number; description: string | null; url: string }> = {};
      for (const item of data.items) {
        const name = item.repository.full_name;
        repoMap[name] = {
          commits: (repoMap[name]?.commits ?? 0) + 1,
          description: item.repository.description,
          url: item.repository.html_url,
        };
      }

      // Take the top 6 repos by commit count to keep the dashboard widget compact
      // and to limit the number of subsequent language API calls (6 REST requests max).
      const repos = Object.entries(repoMap)
        .map(([name, { commits, description, url }]) => ({ name, commits, description, url }))
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 6);

      // Fetch language breakdown for each top repo using the REST API (5,000/hr limit).
      // Promise.all runs these concurrently — 6 parallel requests, well within quota.
      const reposWithLanguages = await Promise.all(
        repos.map(async (repo) => {
          const languages = await fetchRepoLanguages(token, repo.name);
          return languages.length > 0 ? { ...repo, languages } : repo;
        })
      );

      return { repos: reposWithLanguages, days };
    }
  );
}

export async function GET(req: NextRequest) {
  // Session contains the GitHub OAuth token issued at sign-in.
  // Both accessToken and githubLogin are required: token for API auth,
  // login for the Commit Search query filter.
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const parsedDays = daysParam ? parseInt(daysParam, 10) : NaN;
  // Clamp days between 1 and 365 — GitHub Commit Search supports up to ~1 year lookback.
  const days = isNaN(parsedDays) ? 30 : Math.max(1, Math.min(365, parsedDays));
  const accountId = req.nextUrl.searchParams.get("accountId");
  const bypass = isMetricsCacheBypassed(req);

  let orgName: string | null = null;
  let targetAccountId: string | null = accountId;

  if (accountId && accountId.startsWith("org:")) {
    const parts = accountId.split(":");
    targetAccountId = parts[1];
    orgName = parts[2];
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
    } catch (err) {
      console.error("Failed to load excluded orgs config:", err);
    }
  }

  // No accountId = use the primary signed-in GitHub account only.
  if (!targetAccountId) {
    try {
      const result = await fetchReposForAccount(
        session.accessToken,
        session.githubLogin,
        days,
        { bypass, userId: session.githubId ?? session.githubLogin },
        orgName,
        excludedOrgs
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

  if (targetAccountId === "combined") {
    const accounts = await getAllAccounts(
      {
        token: session.accessToken,
        githubId: session.githubId,
        githubLogin: session.githubLogin,
      },
      userRow.id
    );

    // Each account makes its own Search API call — N accounts = N requests
    // against the 30 req/min Search API limit. Promise.allSettled ensures one
    // account's rate limit error or expired token doesn't block the others.
    const results = await Promise.allSettled(
      accounts.map((account) =>
        fetchReposForAccount(
          account.token,
          account.githubLogin,
          days,
          { bypass, userId: account.githubId },
          orgName,
          excludedOrgs
        )
      )
    );

    // mergeMetrics collects only fulfilled results and merges them via mergeRepoCommits.
    // If all accounts fail (e.g. all rate limited), merged will be null → 502.
    const merged = mergeMetrics(results, (a, b) => ({
      days: a.days,
      repos: mergeRepoCommits(a.repos, b.repos),
    }));

    if (!merged) {
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }

    return Response.json(merged);
  }

  // accountId matches the primary session account — no extra token lookup needed.
  if (targetAccountId === session.githubId) {
    try {
      const result = await fetchReposForAccount(
        session.accessToken,
        session.githubLogin,
        days,
        { bypass, userId: session.githubId },
        orgName,
        excludedOrgs
      );
      return Response.json(result);
    } catch (e) {
      if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
      return Response.json({ error: "GitHub API error" }, { status: 502 });
    }
  }

  try {
    // accountId is a different linked account — look up its token from Supabase.
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

    const result = await fetchReposForAccount(
      accountToken,
      accountRow.github_login,
      days,
      { bypass, userId: targetAccountId },
      orgName,
      excludedOrgs
    );
    return Response.json(result);
  } catch (e) {
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
