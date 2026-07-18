/**
 * Activity formatter utilities extracted from the metrics/activity route.
 *
 * Keeping these in a standalone module allows unit tests to import the
 * pure formatting logic without pulling in Next.js route machinery (which
 * only permits the HTTP-verb exports GET/POST/etc. from route files).
 */

export type ActivityType = "push" | "pull_request" | "issue" | "release" | "discussion" | "star" | "review" | "create" | "other";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  createdAt: string;
  title: string;
  subtitle: string;
  repo: string;
  url: string;
}

export interface RawEvent {
  id: string;
  type: string;
  created_at: string;
  repo?: { name?: string };
  payload?: {
    ref_type?: string;
    ref?: string;
    head?: string;
    action?: string;
    commits?: Array<{ sha?: string }>;
    pull_request?: {
      html_url?: string;
      number?: number;
      title?: string;
      merged?: boolean;
    };
    issue?: {
      html_url?: string;
      number?: number;
      title?: string;
    };
    release?: {
      html_url?: string;
      tag_name?: string;
      name?: string;
    };
    discussion?: {
      html_url?: string;
      number?: number;
      title?: string;
    };
  };
}

export const SUPPORTED_EVENT_TYPES = new Set([
  "PushEvent",
  "PullRequestEvent",
  "IssuesEvent",
  "ReleaseEvent",
  "DiscussionEvent",
  "DiscussionCommentEvent",
  "WatchEvent",
  "PullRequestReviewEvent",
  "CreateEvent",
]);

function getRepoUrl(repoName: string): string {
  return `https://github.com/${repoName}`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : "Updated";
}

export function formatActivity(event: RawEvent): ActivityItem | null {
  const repoName = event.repo?.name;

  if (!repoName || !SUPPORTED_EVENT_TYPES.has(event.type)) {
    return null;
  }

  if (event.type === "PushEvent") {
    const commitCount = event.payload?.commits?.length ?? 0;
    const rawRef = event.payload?.ref ?? "";
    const branch = rawRef.replace("refs/heads/", "") || "default branch";
    const plural = commitCount === 1 ? "" : "s";

    return {
      id: event.id,
      type: "push",
      createdAt: event.created_at,
      title: `Pushed ${commitCount} commit${plural} to ${branch}`,
      subtitle: repoName,
      repo: repoName,
      url: event.payload?.head
        ? `https://github.com/${repoName}/commit/${event.payload.head}`
        : getRepoUrl(repoName),
    };
  }

  if (event.type === "PullRequestEvent") {
    const action = event.payload?.action ?? "updated";
    const pr = event.payload?.pull_request;
    const number = pr?.number ? `#${pr.number}` : "PR";
    const wasMerged = action === "closed" && pr?.merged === true;
    const actionText = wasMerged ? "Merged" : capitalize(action);

    return {
      id: event.id,
      type: "pull_request",
      createdAt: event.created_at,
      title: `${actionText} pull request ${number}`,
      subtitle: pr?.title ?? repoName,
      repo: repoName,
      url: pr?.html_url ?? getRepoUrl(repoName),
    };
  }

  if (event.type === "IssuesEvent") {
    const action = event.payload?.action ?? "updated";
    const issue = event.payload?.issue;
    const number = issue?.number ? `#${issue.number}` : "Issue";
    const actionText = capitalize(action);

    return {
      id: event.id,
      type: "issue",
      createdAt: event.created_at,
      title: `${actionText} issue ${number}`,
      subtitle: issue?.title ?? repoName,
      repo: repoName,
      url: issue?.html_url ?? getRepoUrl(repoName),
    };
  }

  if (event.type === "ReleaseEvent") {
    const action = event.payload?.action ?? "published";
    const release = event.payload?.release;
    const tag = release?.tag_name ?? "release";
    const actionText = capitalize(action);

    return {
      id: event.id,
      type: "release",
      createdAt: event.created_at,
      title: `${actionText} ${tag}`,
      subtitle: release?.name ?? repoName,
      repo: repoName,
      url: release?.html_url ?? getRepoUrl(repoName),
    };
  }
  if (event.type === "DiscussionEvent") {
    const action = event.payload?.action ?? "opened";
    const discussion = event.payload?.discussion;
    const number = discussion?.number ? `#${discussion.number}` : "Discussion";
    const actionText = capitalize(action);

    return {
      id: event.id,
      type: "discussion",
      createdAt: event.created_at,
      title: `${actionText} discussion ${number}`,
      subtitle: discussion?.title ?? repoName,
      repo: repoName,
      url: discussion?.html_url ?? getRepoUrl(repoName),
    };
  }

  if (event.type === "DiscussionCommentEvent") {
    const discussion = event.payload?.discussion;
    const number = discussion?.number ? `#${discussion.number}` : "Discussion";

    return {
      id: event.id,
      type: "discussion",
      createdAt: event.created_at,
      title: `Commented on discussion ${number}`,
      subtitle: discussion?.title ?? repoName,
      repo: repoName,
      url: discussion?.html_url ?? getRepoUrl(repoName),
    };
  }

  if (event.type === "WatchEvent") {
    return {
      id: event.id,
      type: "star",
      createdAt: event.created_at,
      title: `Starred ${repoName}`,
      subtitle: repoName,
      repo: repoName,
      url: getRepoUrl(repoName),
    };
  }

  if (event.type === "PullRequestReviewEvent") {
    const pr = event.payload?.pull_request;
    const number = pr?.number ? `#${pr.number}` : "a PR";
    return {
      id: event.id,
      type: "review",
      createdAt: event.created_at,
      title: `Reviewed PR ${number}`,
      subtitle: pr?.title ?? repoName,
      repo: repoName,
      url: pr?.html_url ?? getRepoUrl(repoName),
    };
  }

  if (event.type === "CreateEvent") {
    const refType = event.payload?.ref_type ?? "branch";
    const ref = event.payload?.ref ? ` "${event.payload.ref}"` : "";
    return {
      id: event.id,
      type: "create",
      createdAt: event.created_at,
      title: `Created ${refType}${ref}`,
      subtitle: repoName,
      repo: repoName,
      url: getRepoUrl(repoName),
    };
  }

  return null;
}

// ─── GraphQL discussion types ─────────────────────────────────────────────────

/**
 * A single node from the `viewer.repositoryDiscussionComments` GraphQL query.
 * Represents a discussion comment authored by the authenticated user.
 */
export interface GraphQLDiscussionCommentNode {
  createdAt: string;
  url: string;
  discussion: {
    title: string;
    number: number;
    url: string;
    repository: {
      nameWithOwner: string;
    };
  };
}

/**
 * Normalize a GitHub GraphQL discussion comment node into the shared
 * ActivityItem format consumed by the RecentActivity widget.
 *
 * The item URL points to the discussion (not the individual comment) so
 * users land on the full context rather than a deep anchor.
 */
export function formatGraphQLDiscussionComment(
  node: GraphQLDiscussionCommentNode
): ActivityItem {
  return {
    id: `gql-disc-${node.url}`,
    type: "discussion",
    createdAt: node.createdAt,
    title: `Commented on discussion #${node.discussion.number}`,
    subtitle: node.discussion.title,
    repo: node.discussion.repository.nameWithOwner,
    url: node.discussion.url,
  };
}

/**
 * Merge REST-event activity items with GraphQL discussion items.
 *
 * Deduplication key: `type-repo-createdAt-title` — any item that appears
 * in both the REST events feed and the GraphQL discussion feed (e.g. a
 * DiscussionCommentEvent from REST that matches a comment from GraphQL)
 * is collapsed to a single entry.  The result is sorted newest-first.
 */
export function mergeActivityItems(
  restItems: ActivityItem[],
  discussionItems: ActivityItem[]
): ActivityItem[] {
  const all = [...restItems, ...discussionItems];
  return Array.from(
    new Map(
      all.map((item) => [
        `${item.type}-${item.repo}-${item.createdAt}-${item.title}`,
        item,
      ])
    ).values()
  ).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
