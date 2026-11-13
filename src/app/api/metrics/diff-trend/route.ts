import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubRequest } from "@/lib/github-request";
import {
  collectAuthorCommits,
  requireUnthrottled,
  scopeCommits,
} from "@/lib/github-search";
import { getServerSession } from "@/lib/server-session";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { GITHUB_API } from "@/lib/github";
import { GitHubAuthError, githubAuthErrorResponse } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase";
import {
  authorWeeks,
  buildDiffTrendWeeks,
  type ContributorStats,
  diffTrendWeekStarts,
  type DiffTrendResponse,
  lacksLineCounts,
  topCommitRepos,
} from "@/lib/diff-trend";

export const dynamic = "force-dynamic";

/** GitHub answers 202 while it computes a repository's statistics. */
class StatsComputingError extends Error {}

type RepoCommit = {
  repository: { full_name: string };
  commit: { author: { date: string } };
};

/** The repository's per-author weekly stats, or null when it has none to give. */
async function fetchContributorStats(
  token: string,
  repo: string
): Promise<ContributorStats[] | null> {
  const [owner, name] = repo.split("/");
  const res = await githubRequest(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/stats/contributors`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );
  if (res.status === 202) throw new StatsComputingError();
  if (res.status === 401) throw new GitHubAuthError();
  // 204: empty repository. 403/404: access lost since the commits were made.
  if (!res.ok || res.status === 204) return null;
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as ContributorStats[]) : null;
}

async function fetchDiffTrend(
  token: string,
  githubLogin: string,
  cacheContext: { bypass: boolean; userId: string },
  excludedOrgs: string[]
): Promise<DiffTrendResponse> {
  const key = metricsCacheKey(cacheContext.userId, "diff-trend", {
    githubLogin,
    excludedOrgs: excludedOrgs.length > 0 ? excludedOrgs.join(",") : undefined,
  });

  // A StatsComputingError escapes the loader, so a half-built answer is never cached.
  return withMetricsCache(
    {
      bypass: cacheContext.bypass,
      key,
      ttlSeconds: METRICS_CACHE_TTL_SECONDS["diff-trend"],
    },
    async () => {
      const weekStarts = diffTrendWeekStarts(new Date());
      const since = new Date(weekStarts[0] * 1000).toISOString().slice(0, 10);

      // Ranking repos reads the shared commit timeline, so it costs no searches.
      const search = requireUnthrottled(
        await collectAuthorCommits<RepoCommit>(githubLogin, since, token, {
          fresh: cacheContext.bypass,
        })
      );
      const candidates = topCommitRepos(
        scopeCommits(search.items, { excludedOrgs })
      );

      const stats = await Promise.all(
        candidates.map((repo) => fetchContributorStats(token, repo))
      );

      const repos: string[] = [];
      const repoWeeks: Array<ContributorStats["weeks"]> = [];
      candidates.forEach((repo, i) => {
        const weeks = stats[i] && authorWeeks(stats[i], githubLogin);
        if (!weeks || lacksLineCounts(weeks, weekStarts)) return;
        repos.push(repo);
        repoWeeks.push(weeks);
      });

      return { weeks: buildDiffTrendWeeks(weekStarts, repoWeeks), repos };
    }
  );
}

async function loadExcludedOrgs(githubId: string): Promise<string[]> {
  if (!isSupabaseAdminAvailable) return [];
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("organizations_config")
      .eq("github_id", githubId)
      .single();
    const config = (data?.organizations_config || {}) as Record<
      string,
      boolean
    >;
    return Object.entries(config)
      .filter(([, enabled]) => enabled === false)
      .map(([org]) => org);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.error === "TokenRevoked") {
    return githubAuthErrorResponse();
  }

  const excludedOrgs = session.githubId
    ? await loadExcludedOrgs(session.githubId)
    : [];

  try {
    const result = await fetchDiffTrend(
      session.accessToken,
      session.githubLogin,
      {
        bypass: isMetricsCacheBypassed(req),
        userId: session.githubId ?? session.githubLogin,
      },
      excludedOrgs
    );
    return Response.json(result);
  } catch (e) {
    if (e instanceof StatsComputingError) {
      return Response.json({ computing: true }, { status: 202 });
    }
    const githubLimit = githubRateLimitResponse(e);
    if (githubLimit) return githubLimit;
    if (e instanceof GitHubAuthError) return githubAuthErrorResponse();
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
