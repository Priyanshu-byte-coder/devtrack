import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubRequest } from "@/lib/github-request";
import { getServerSession } from "@/lib/server-session";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { getAccountToken, getAllAccounts } from "@/lib/github-accounts";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { resolveAppUser } from "@/lib/resolve-user";
import { supabaseAdmin } from "@/lib/supabase";
import { isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import {
  legacyPullRequestFields,
  PULL_REQUESTS_QUERY,
  pullRequestQueries,
  RANGE_DAYS,
  summarizePullRequests,
  type PullRequestNode,
  type PullRequestRange,
  type PullRequestRaw,
  type ReviewContributionNode,
} from "@/lib/pull-requests";

export const dynamic = "force-dynamic";

interface QueryResult {
  inRange: { issueCount: number; nodes: PullRequestNode[] };
  openNow: { issueCount: number; nodes: PullRequestNode[] };
  user: {
    contributionsCollection: {
      pullRequestReviewContributions: {
        totalCount: number;
        nodes: ReviewContributionNode[];
      };
    };
  } | null;
}

function parseRange(value: string | null): PullRequestRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

/** One GraphQL request per account: it used to be ~22 REST and search calls. */
async function fetchPullRequestRaw(
  token: string,
  login: string,
  range: PullRequestRange,
  scope: { org: string | null; excludedOrgs: string[] }
): Promise<PullRequestRaw> {
  const from = new Date(Date.now() - RANGE_DAYS[range] * 86_400_000);
  const queries = pullRequestQueries(
    login,
    from.toISOString().slice(0, 10),
    scope
  );
  const res = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: PULL_REQUESTS_QUERY,
      variables: { ...queries, login, from: from.toISOString() },
    }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL failed: ${res.status}`);
  const json = (await res.json()) as { data?: QueryResult };
  if (!json.data) throw new Error("GitHub returned no pull request data");

  // Search can return non-PR nodes as empty objects; keep real PRs only.
  const prs = (nodes: PullRequestNode[]) => nodes.filter((n) => n?.url);
  const reviews =
    json.data.user?.contributionsCollection.pullRequestReviewContributions;
  return {
    login,
    inRange: prs(json.data.inRange.nodes),
    inRangeTotal: json.data.inRange.issueCount,
    openNow: prs(json.data.openNow.nodes),
    openTotal: json.data.openNow.issueCount,
    reviews: reviews?.nodes ?? [],
    reviewsTotal: reviews?.totalCount ?? 0,
  };
}

function cachedRaw(
  token: string,
  login: string,
  range: PullRequestRange,
  scope: { org: string | null; excludedOrgs: string[] },
  cache: { bypass: boolean; userId: string }
) {
  const key = metricsCacheKey(cache.userId, "prs", {
    v: 2,
    range,
    githubLogin: login,
    orgName: scope.org ?? undefined,
    excludedOrgs: scope.excludedOrgs.join(",") || undefined,
  });
  return withMetricsCache(
    { bypass: cache.bypass, key, ttlSeconds: METRICS_CACHE_TTL_SECONDS.prs },
    () => fetchPullRequestRaw(token, login, range, scope)
  );
}

async function loadExcludedOrgs(userId: string): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("organizations_config")
      .eq("id", userId)
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

  const range = parseRange(req.nextUrl.searchParams.get("range"));
  const bypass = isMetricsCacheBypassed(req);
  let accountId = req.nextUrl.searchParams.get("accountId");
  let org: string | null = null;
  if (accountId?.startsWith("org:")) {
    const [, id, name] = accountId.split(":");
    accountId = id || null;
    org = name || null;
  }

  const userRow =
    isSupabaseAdminAvailable && session.githubId
      ? await resolveAppUser(session.githubId, session.githubLogin)
      : null;
  const scope = {
    org,
    excludedOrgs: userRow ? await loadExcludedOrgs(userRow.id) : [],
  };
  const primaryId = session.githubId ?? session.githubLogin;

  try {
    let raws: PullRequestRaw[];

    if (!accountId || accountId === session.githubId) {
      raws = [
        await cachedRaw(
          session.accessToken,
          session.githubLogin,
          range,
          scope,
          {
            bypass,
            userId: primaryId,
          }
        ),
      ];
    } else {
      if (!userRow || !session.githubId) {
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
        const settled = await Promise.allSettled(
          accounts.map((a) =>
            cachedRaw(a.token, a.githubLogin, range, scope, {
              bypass,
              userId: a.githubId,
            })
          )
        );
        raws = settled
          .filter(
            (r): r is PromiseFulfilledResult<PullRequestRaw> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value);
        if (raws.length === 0) {
          const failure = settled.find(
            (r): r is PromiseRejectedResult => r.status === "rejected"
          );
          throw failure?.reason ?? new Error("No accounts found");
        }
      } else {
        const token = await getAccountToken(userRow.id, accountId);
        const { data: accountRow } = await supabaseAdmin
          .from("user_github_accounts")
          .select("github_login")
          .eq("user_id", userRow.id)
          .eq("github_id", accountId)
          .single();
        if (!token || !accountRow?.github_login) {
          return Response.json({ error: "Account not found" }, { status: 404 });
        }
        raws = [
          await cachedRaw(token, accountRow.github_login, range, scope, {
            bypass,
            userId: accountId,
          }),
        ];
      }
    }

    const summary = summarizePullRequests(raws, range);
    return Response.json({
      ...legacyPullRequestFields(summary),
      summary,
      reviews: {
        totalReviews: summary.reviews.total,
        approvalRate:
          summary.reviews.total > 0
            ? `${Math.round((summary.reviews.approved / summary.reviews.total) * 100)}%`
            : "0%",
        topRepos: summary.reviews.topRepos,
      },
    });
  } catch (error) {
    const githubLimit = githubRateLimitResponse(error);
    if (githubLimit) return githubLimit;
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
