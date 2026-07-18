import { getSessionWithToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { getAccountToken, getAllAccounts } from "@/lib/github-accounts";
import { GITHUB_API, fetchUserEvents } from "@/lib/github";
import { githubGraphQL } from "@/lib/github-fetch";
import {
  isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import {
  type ActivityItem,
  type RawEvent,
  type GraphQLDiscussionCommentNode,
  formatActivity,
  formatGraphQLDiscussionComment,
  mergeActivityItems,
} from "@/lib/activity-formatter";

export const dynamic = "force-dynamic";

// ─── GraphQL discussion query ─────────────────────────────────────────────────

/**
 * Fetches the 20 most recent discussion comments the authenticated user has
 * made across all repositories.  `repositoryDiscussionComments` is the most
 * reliable GitHub GraphQL field for this purpose — the REST /user/events
 * endpoint does not consistently surface DiscussionCommentEvent entries.
 */
const DISCUSSION_COMMENTS_QUERY = `
  query {
    viewer {
      repositoryDiscussionComments(first: 20) {
        nodes {
          createdAt
          url
          discussion {
            title
            number
            url
            repository {
              nameWithOwner
            }
          }
        }
      }
    }
  }
`;

interface DiscussionCommentsQueryResult {
  viewer: {
    repositoryDiscussionComments: {
      nodes: GraphQLDiscussionCommentNode[];
    };
  };
}

/**
 * Fetches recent discussion-comment activity via GraphQL.
 * Returns an empty array on any failure so callers never need to handle
 * errors from this path — discussions are supplementary, not a hard
 * dependency of the activity feed.
 */
async function fetchDiscussionItemsViaGraphQL(
  token: string
): Promise<ActivityItem[]> {
  try {
    const data = await githubGraphQL<DiscussionCommentsQueryResult>(
      DISCUSSION_COMMENTS_QUERY,
      token
    );
    const nodes = data?.viewer?.repositoryDiscussionComments?.nodes ?? [];
    return nodes.map(formatGraphQLDiscussionComment);
  } catch {
    // Discussions may be disabled, rate-limited, or the token may lack the
    // required scope — never allow this to block the main activity feed.
    return [];
  }
}

// ─── Activity fetching ────────────────────────────────────────────────────────

async function fetchFormattedActivity(token: string): Promise<ActivityItem[]> {
  // Run REST events and GraphQL discussions in parallel.
  // fetchDiscussionItemsViaGraphQL always resolves (returns [] on error) so
  // Promise.all only rejects if fetchUserEvents throws — preserving the
  // existing error-propagation path through fetchFormattedActivityWithFallback.
  const [events, discussionItems] = await Promise.all([
    fetchUserEvents(token) as Promise<RawEvent[]>,
    fetchDiscussionItemsViaGraphQL(token),
  ]);

  const restItems = events
    .map(formatActivity)
    .filter((item): item is ActivityItem => item !== null);

  return mergeActivityItems(restItems, discussionItems);
}

async function fetchPublicEvents(
  token: string,
  githubLogin: string
): Promise<RawEvent[]> {
  const response = await fetch(
    `${GITHUB_API}/users/${encodeURIComponent(githubLogin)}/events/public?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("GitHub API error");
  }

  return (await response.json()) as RawEvent[];
}

async function fetchFormattedActivityWithFallback(
  token: string,
  githubLogin?: string
): Promise<ActivityItem[]> {
  try {
    return await fetchFormattedActivity(token);
  } catch (e) {
    if (!githubLogin) {
      throw new Error("GitHub API error");
    }

    // The primary REST endpoint failed; use the public events fallback.
    // Run it in parallel with the GraphQL discussion fetch so discussion
    // activity is still included even when /user/events is unavailable.
    const [events, discussionItems] = await Promise.all([
      fetchPublicEvents(token, githubLogin),
      fetchDiscussionItemsViaGraphQL(token),
    ]);

    const restItems = events
      .map(formatActivity)
      .filter((item): item is ActivityItem => item !== null);

    return mergeActivityItems(restItems, discussionItems);
  }
}

export async function GET(req: NextRequest) {
  const sessionData = await getSessionWithToken();

  if (!sessionData || !sessionData.session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = sessionData.session;
  const accessToken = sessionData.accessToken;
  const githubLogin: string = session.githubLogin!;
  const accountId = req.nextUrl.searchParams.get("accountId");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const offsetParam = req.nextUrl.searchParams.get("offset");

  let limit = limitParam ? parseInt(limitParam, 10) : 10;
  let offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100;
  if (isNaN(offset) || offset < 0) offset = 0;

  const bypass = isMetricsCacheBypassed(req);
  const cacheKey = metricsCacheKey(
    session.githubId ?? githubLogin,
    "activity",
    { accountId: accountId || undefined }
  );

  try {
    const result = await withMetricsCache(
      {
        bypass,
        key: cacheKey,
        ttlSeconds: METRICS_CACHE_TTL_SECONDS.activity,
      },
      async () => {
        if (!accountId) {
          const items = await fetchFormattedActivityWithFallback(
            accessToken,
            githubLogin
          );
          return { items };
        }

        if (!session.githubId) {
          throw new Error("Unauthorized");
        }

        const userRow = await resolveAppUser(session.githubId, githubLogin);

        if (!userRow) {
          throw new Error("Unauthorized");
        }

        if (accountId === "combined") {
          const accounts = await getAllAccounts(
            {
              token: accessToken,
              githubId: session.githubId,
              githubLogin: githubLogin,
            },
            userRow.id
          );

          const results = await Promise.allSettled(
            accounts.map((account) =>
              fetchFormattedActivityWithFallback(
                account.token,
                account.githubLogin
              )
            )
          );

          const mergedActivities = results
            .filter(
              (result): result is PromiseFulfilledResult<ActivityItem[]> =>
                result.status === "fulfilled"
            )
            .flatMap((result) => result.value);

          const uniqueActivities = Array.from(
            new Map(
              mergedActivities.map((item) => [
                `${item.type}-${item.repo}-${item.createdAt}-${item.title}`,
                item,
              ])
            ).values()
          );

          const merged = uniqueActivities
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            );

          if (merged.length === 0 && results.length > 0) {
            const allFailed = results.every(
              (result) => result.status === "rejected"
            );
            if (allFailed) {
              throw new Error("GitHub API error");
            }
          }

          return { items: merged };
        }

        if (accountId === session.githubId) {
          const items = await fetchFormattedActivityWithFallback(
            accessToken,
            githubLogin
          );
          return { items };
        }

        const token = await getAccountToken(userRow.id, accountId);

        if (!token) {
          throw new Error("Account not found");
        }

        const { data: accountRow } = await supabaseAdmin
          .from("user_github_accounts")
          .select("github_login")
          .eq("user_id", userRow.id)
          .eq("github_id", accountId)
          .single();

        if (!accountRow?.github_login) {
          throw new Error("Account not found");
        }

        const items = await fetchFormattedActivityWithFallback(
          token,
          accountRow.github_login
        );
        return { items };
      }
    );

    result.items = (result.items || []).slice(offset, offset + limit);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Account not found") {
        return Response.json({ error: "Account not found" }, { status: 404 });
      }
    }
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}