import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubGraphQL } from "@/lib/github-fetch";
import { collectAuthorCommits, requireUnthrottled } from "@/lib/github-search";
import { getServerSession } from "@/lib/server-session";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { computeHealthScore } from "@/lib/repo-health";
import {
  isMetricsCacheBypassed,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import type {
  RepoHealthResponse,
  RepoHealthSignals,
  RepoHealthScore,
} from "@/types/repo-health";

export const dynamic = "force-dynamic";

interface RepoSummary {
  name: string;
  commits: number;
  url: string;
}
interface RepoListResponse {
  repos: RepoSummary[];
  days: number;
}

async function fetchReposForAccount(
  token: string,
  githubLogin: string,
  days: number
): Promise<RepoListResponse> {
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  // Active repos come from the shared commit timeline, so this costs no extra searches.
  const data = requireUnthrottled(
    await collectAuthorCommits<{
      commit: { author: { date: string } };
      repository: { full_name: string; html_url: string };
    }>(githubLogin, since, token)
  );
  const repoMap: Record<string, { commits: number; url: string }> = {};
  for (const item of data.items) {
    const name = item.repository.full_name;
    if (!repoMap[name])
      repoMap[name] = { commits: 0, url: item.repository.html_url };
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

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}
function daysSince(isoDate: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
  );
}

const REPO_SIGNALS_QUERY = `
  query RepoSignals($owner: String!, $name: String!, $since: GitTimestamp!) {
    repository(owner: $owner, name: $name) {
      issues(states: OPEN) { totalCount }
      recentPrs: pullRequests(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { createdAt closedAt }
      }
      mergedPrs: pullRequests(first: 100, states: MERGED, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes { mergedAt }
      }
      defaultBranchRef {
        target {
          ... on Commit {
            window: history(since: $since) { totalCount }
            latest: history(first: 1) { nodes { committedDate } }
          }
        }
      }
    }
  }
`;

interface RepoSignalsData {
  repository: {
    issues: { totalCount: number };
    recentPrs: { nodes: Array<{ createdAt: string; closedAt: string | null }> };
    mergedPrs: { nodes: Array<{ mergedAt: string | null }> };
    defaultBranchRef: {
      target: {
        window?: { totalCount: number };
        latest?: { nodes: Array<{ committedDate: string }> };
      };
    } | null;
  } | null;
}

// One GraphQL request per repo replaces four Search API calls: six repos used to
// spend 24 of the 30 searches/minute shared by the whole dashboard.
async function fetchSignalsForRepo(
  token: string,
  repoFullName: string,
  days: number
): Promise<RepoHealthSignals> {
  const sinceMs = Date.now() - days * 86400000;
  const [owner, name] = repoFullName.split("/");
  const { repository } = await githubGraphQL<RepoSignalsData>(
    REPO_SIGNALS_QUERY,
    token,
    {
      owner,
      name,
      since: new Date(sinceMs).toISOString(),
    }
  );
  if (!repository) throw new Error("Repository not found");

  const opened = repository.recentPrs.nodes.filter(
    (pr) => Date.parse(pr.createdAt) > sinceMs
  );
  const mergedCount = repository.mergedPrs.nodes.filter(
    (pr) => pr.mergedAt && Date.parse(pr.mergedAt) > sinceMs
  ).length;
  const closedItems = opened.filter((pr) => pr.closedAt);
  const avgPrOpenTimeHours =
    closedItems.length > 0
      ? closedItems.reduce(
          (sum, pr) => sum + hoursBetween(pr.createdAt, pr.closedAt!),
          0
        ) / closedItems.length
      : 0;

  const target = repository.defaultBranchRef?.target;
  const lastCommitDate = target?.latest?.nodes[0]?.committedDate ?? null;

  return {
    commitFrequency: target?.window?.totalCount ?? 0,
    prMergeRate: opened.length > 0 ? mergedCount / opened.length : 0,
    avgPrOpenTimeHours,
    openIssuesCount: repository.issues.totalCount,
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
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedDays = parseInt(
    req.nextUrl.searchParams.get("days") ?? "30",
    10
  );
  // Only allow 7, 30, or 90 day windows — other values default to 30.
  const days =
    requestedDays === 7 || requestedDays === 30 || requestedDays === 90
      ? requestedDays
      : 30;

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(
    session.githubId ?? session.githubLogin,
    "repo-health" as any,
    { days }
  );

  try {
    // Cache TTL of 10 minutes (600 seconds) — repo health signals (commit frequency,
    // PR merge rate, open issues) change slowly and each load costs one GraphQL
    // request per repo.
    const data = await withMetricsCache(
      { bypass, key, ttlSeconds: 10 * 60 },
      async () => {
        // Step 1: identify the top 6 repos from the shared commit timeline.
        const topRepos = (
          await fetchReposForAccount(
            session.accessToken!,
            session.githubLogin!,
            days
          )
        ).repos;

        const scores: RepoHealthScore[] = [];
        for (const repo of topRepos) {
          try {
            // Step 2: fetch health signals for each repo (one GraphQL request per repo).
            // Individual repo failures are silently skipped — a rate limit on one repo
            // should not prevent health scores for the remaining repos from loading.
            const signals = await fetchSignalsForRepo(
              session.accessToken!,
              repo.name,
              days
            );
            scores.push(computeHealthScore(repo.name, signals));
          } catch (e) {
            // Swallow per-repo errors (rate limit, private repo, network blip).
            // The repo is simply omitted from the scores array rather than failing the request.
          }
        }
        return { repos: scores };
      }
    );
    return Response.json(data);
  } catch (e) {
    const githubLimit = githubRateLimitResponse(e);
    if (githubLimit) return githubLimit;

    // Catches errors from fetchReposForAccount (the shared commit timeline).
    // Returns 502 so the client shows an error state rather than an empty health widget.
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
