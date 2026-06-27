import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { computeHealthScore } from "@/lib/repo-health";
import { isMetricsCacheBypassed, metricsCacheKey, withMetricsCache } from "@/lib/metrics-cache";
import type { RepoHealthResponse, RepoHealthSignals, RepoHealthScore } from "@/types/repo-health";

export const dynamic = "force-dynamic";
const GITHUB_API = "https://api.github.com";

interface RepoSummary { name: string; commits: number; url: string; }
interface RepoListResponse { repos: RepoSummary[]; days: number; }

async function fetchReposForAccount(token: string, githubLogin: string, days: number): Promise<RepoListResponse> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // GitHub Commit Search API — finds recent commits to identify the user's active repos.
  // Rate limits:
  //   • Authenticated (OAuth token / PAT): 30 requests/minute
  //   • Unauthenticated:                   10 requests/minute
  // This single request costs 1 of the 30 req/min quota.
  // The outer withMetricsCache (ttlSeconds: 10 * 60) in the GET handler prevents
  // re-fetching on every page load — this is only called on a cache miss.
  const searchRes = await fetch(
    `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${since}&per_page=100&sort=author-date&order=desc`,
    {
      headers: {
        // OAuth token / PAT: raises the Search API limit from 10 → 30 req/min.
        // Without this, a single repo-health load could exhaust the unauthenticated
        // 10 req/min quota when combined with other concurrent Search API calls.
        Authorization: `Bearer ${token}`,
        // Mandatory for the Commit Search endpoint — omitting returns HTTP 415.
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  // HTTP 403 = Search API rate limit exceeded. HTTP 422 = malformed query.
  // Throws here so the GET handler catches it and returns HTTP 502 to the client.
  if (!searchRes.ok) throw new Error("API error");

  const data = await searchRes.json();
  const repoMap: Record<string, { commits: number; url: string }> = {};
  for (const item of data.items) {
    const name = item.repository.full_name;
    if (!repoMap[name]) repoMap[name] = { commits: 0, url: item.repository.html_url };
    repoMap[name].commits++;
  }
  // Slice to top 6 repos to cap the number of fetchSignalsForRepo calls below.
  return {
    repos: Object.entries(repoMap)
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 6),
    days,
  };
}

function hoursBetween(a: string, b: string): number { return (new Date(b).getTime() - new Date(a).getTime()) / 3600000; }
function daysSince(isoDate: string): number { return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)); }

// Shared fetch helper for all GitHub API calls inside fetchSignalsForRepo.
// Throws on any non-ok response so the per-repo try/catch in the GET handler
// can skip a single failing repo without aborting the entire health check.
async function fetchJson<T>(url: string, token: string, accept?: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      // OAuth token / PAT used for every request — keeps all calls in the
      // authenticated tier (5,000/hr REST, 30/min Search API).
      Authorization: `Bearer ${token}`,
      Accept: accept ?? "application/vnd.github+json",
    },
    cache: "no-store",
  });
  // Non-ok responses include HTTP 403 (rate limit exceeded) and 404 (repo not found).
  if (!res.ok) throw new Error("API error");
  return await res.json();
}

async function fetchSignalsForRepo(token: string, repoFullName: string, days: number): Promise<RepoHealthSignals> {
  const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  // This function makes 5 sequential GitHub API calls per repo:
  //   1. Commit Search   → Search API (30 req/min quota)
  //   2. Opened PRs      → Search API (30 req/min quota)
  //   3. Merged PRs      → Search API (30 req/min quota)
  //   4. Open Issues     → Search API (30 req/min quota)
  //   5. Latest commit   → REST API   (5,000 req/hr quota)
  //
  // With up to 6 repos (from fetchReposForAccount), one full repo-health load
  // can consume up to 24 Search API requests (4 × 6) in a single minute.
  // The 10-minute withMetricsCache TTL in the GET handler is critical here —
  // without it, repeated loads would quickly exhaust the 30 req/min Search limit.
  //
  // Calls 1–4 use the Search API (30 req/min authenticated limit).
  const commitSearch = await fetchJson<any>(
    `${GITHUB_API}/search/commits?q=repo:${repoFullName}+committer-date:>${since}&per_page=100&sort=committer-date&order=desc`,
    token,
    "application/vnd.github+json" // required Accept header for Commit Search
  );
  const openedPrs = await fetchJson<any>(
    `${GITHUB_API}/search/issues?q=repo:${repoFullName}+type:pr+created:>${since}&per_page=100&sort=created&order=desc`,
    token
  );
  const mergedPrs = await fetchJson<any>(
    `${GITHUB_API}/search/issues?q=repo:${repoFullName}+type:pr+is:merged+merged:>${since}&per_page=100&sort=updated&order=desc`,
    token
  );

  const openedCount = openedPrs.total_count || 0;
  const mergedCount = mergedPrs.total_count || 0;
  const closedItems = (openedPrs.items ?? []).filter((i: any) => i.closed_at);
  const avgPrOpenTimeHours = closedItems.length > 0
    ? closedItems.reduce((sum: number, pr: any) => sum + hoursBetween(pr.created_at, pr.closed_at!), 0) / closedItems.length
    : 0;

  // Call 4 — open issue count via Search API (counts toward the 30 req/min limit).
  // per_page=1 minimises response size since we only need total_count.
  const openIssues = await fetchJson<any>(
    `${GITHUB_API}/search/issues?q=repo:${repoFullName}+type:issue+state:open&per_page=1`,
    token
  );

  // Call 5 — latest commit date via REST API (5,000 req/hr, separate from Search quota).
  // per_page=1 fetches only the most recent commit to minimise payload size.
  const commits = await fetchJson<any>(
    `${GITHUB_API}/repos/${repoFullName}/commits?per_page=1`,
    token
  );
  const lastCommitDate = commits?.[0]?.commit?.committer?.date ?? null;

  return {
    commitFrequency: Array.isArray(commitSearch.items) ? commitSearch.items.length : 0,
    prMergeRate: openedCount > 0 ? mergedCount / openedCount : 0,
    avgPrOpenTimeHours,
    openIssuesCount: openIssues.total_count || 0,
    // 9999 signals "no commits found" — treated as maximum staleness by computeHealthScore.
    daysSinceLastCommit: lastCommitDate ? daysSince(lastCommitDate) : 9999,
    contributorCount: 0,
    documentationScore: 0,
  };
}

export async function GET(req: NextRequest) {
  // Session contains the GitHub OAuth token issued at sign-in.
  // Both accessToken and githubLogin are required for the API calls below.
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken || !session?.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedDays = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
  // Only allow 7, 30, or 90 day windows — other values default to 30.
  const days = requestedDays === 7 || requestedDays === 30 || requestedDays === 90 ? requestedDays : 30;

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(session?.githubId ?? session?.githubLogin, "repo-health" as any, { days });

  try {
    // Cache TTL of 10 minutes (600 seconds) — longer than most other metrics because
    // repo health signals (commit frequency, PR merge rate, open issues) change slowly
    // and fetchSignalsForRepo is expensive: up to 24 Search API calls for 6 repos.
    // Without this cache, a single user refreshing the page repeatedly could exhaust
    // the 30 req/min Search API quota in under 2 minutes.
    const data = await withMetricsCache({ bypass, key, ttlSeconds: 10 * 60 }, async () => {
      // Step 1: identify the top 6 repos via Commit Search (1 Search API request).
      const topRepos = (await fetchReposForAccount(accessToken!, session?.githubLogin!, days)).repos;

      const scores: RepoHealthScore[] = [];
      for (const repo of topRepos) {
        try {
          // Step 2: fetch health signals for each repo (up to 4 Search + 1 REST per repo).
          // Individual repo failures are silently skipped — a rate limit on one repo
          // should not prevent health scores for the remaining repos from loading.
          const signals = await fetchSignalsForRepo(accessToken!, repo.name, days);
          scores.push(computeHealthScore(repo.name, signals));
        } catch (e) {
          // Swallow per-repo errors (rate limit, private repo, network blip).
          // The repo is simply omitted from the scores array rather than failing the request.
        }
      }
      return { repos: scores };
    });
    return Response.json(data);
  } catch (e) {
    // Catches errors from fetchReposForAccount (the initial Search API call).
    // Returns 502 so the client shows an error state rather than an empty health widget.
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
