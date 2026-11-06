/**
 * cv-github-fetcher.ts
 *
 * Fetches comprehensive GitHub contribution data using a single GraphQL query.
 * This module is the data-acquisition layer for the AI-Powered CV Generator.
 *
 * @module cv-github-fetcher
 */

import { githubGraphQL, GitHubRateLimitError } from "@/lib/github-fetch";
import type {
  GitHubContributionData,
  RepositoryData,
  PullRequestData,
  CommitData,
  ContributionStats,
} from "@/types/cv-types";

/* ------------------------------------------------------------------ */
/*  GraphQL response shapes                                            */
/* ------------------------------------------------------------------ */

interface GQLLanguageNode {
  name: string;
}

interface GQLTopicNode {
  topic: { name: string };
}

interface GQLLabelNode {
  name: string;
}

interface GQLPullRequestNode {
  title: string;
  body: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  state: "MERGED" | "OPEN" | "CLOSED";
  mergedAt: string | null;
  createdAt: string;
  labels: { nodes: GQLLabelNode[] };
}

interface GQLCommitNode {
  message: string;
  committedDate: string;
}

interface GQLRepositoryNode {
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  stargazerCount: number;
  forkCount: number;
  isFork: boolean;
  languages: { nodes: GQLLanguageNode[] };
  repositoryTopics: { nodes: GQLTopicNode[] };
  pullRequests: { nodes: GQLPullRequestNode[] };
  defaultBranchRef: {
    target: {
      history: { nodes: GQLCommitNode[] };
    };
  } | null;
}

interface GQLContributionsCollection {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  totalPullRequestReviewContributions: number;
  contributionCalendar: { totalContributions: number };
}

interface GQLUserResponse {
  user: {
    login: string;
    avatarUrl: string;
    bio: string | null;
    repositories: {
      nodes: GQLRepositoryNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
    contributionsCollection: GQLContributionsCollection;
  };
}

/* ------------------------------------------------------------------ */
/*  Query builder                                                      */
/* ------------------------------------------------------------------ */

/** Repositories fetched in total, and per request. */
const REPO_LIMIT = 50;
const REPO_PAGE_SIZE = 10;

/**
 * One page of repositories with their merged PRs and recent default-branch
 * commits. GitHub answers 502 once a query exceeds its ~10s budget: fifty
 * repositories in one request did, as did per-commit diff stats, so
 * repositories are paged and commits carry no diff stats.
 *
 * Note: The `history` fragment omits the `author` filter because the
 * viewer's node-ID is not readily available in a single-shot query.
 * Commits are scoped per-repo and limited to 30, so the noise is minimal.
 */
const CONTRIBUTION_QUERY = `
query CvContributions($login: String!, $first: Int!, $after: String) {
  user(login: $login) {
    login
    avatarUrl
    bio
    repositories(
      first: $first
      after: $after
      orderBy: { field: PUSHED_AT, direction: DESC }
      ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        nameWithOwner
        description
        url
        stargazerCount
        forkCount
        isFork
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          nodes { name }
        }
        repositoryTopics(first: 10) {
          nodes { topic { name } }
        }
        pullRequests(
          first: 20
          states: MERGED
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes {
            title
            body
            additions
            deletions
            changedFiles
            state
            mergedAt
            createdAt
            labels(first: 5) { nodes { name } }
          }
        }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 30) {
                nodes {
                  message
                  committedDate
                }
              }
            }
          }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar { totalContributions }
    }
  }
}`;

/* ------------------------------------------------------------------ */
/*  Data mappers                                                       */
/* ------------------------------------------------------------------ */

/** Maps a raw GraphQL pull-request node to the application type. */
function mapPullRequest(pr: GQLPullRequestNode): PullRequestData {
  return {
    title: pr.title,
    body: pr.body,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    labels: pr.labels.nodes.map((l) => l.name),
    state: pr.state,
    mergedAt: pr.mergedAt,
    createdAt: pr.createdAt,
  };
}

/** Maps a raw GraphQL commit node to the application type. */
function mapCommit(c: GQLCommitNode): CommitData {
  return {
    message: c.message,
    committedDate: c.committedDate,
    // Per-commit diff stats are too slow for GitHub to compute in bulk (the
    // query 502s); line totals come from merged pull requests instead.
    additions: 0,
    deletions: 0,
  };
}

/** Maps a raw GraphQL repository node to the application type. */
function mapRepository(repo: GQLRepositoryNode): RepositoryData {
  const commits: CommitData[] =
    repo.defaultBranchRef?.target?.history?.nodes?.map(mapCommit) ?? [];

  return {
    name: repo.name,
    nameWithOwner: repo.nameWithOwner,
    description: repo.description,
    url: repo.url,
    stargazerCount: repo.stargazerCount,
    forkCount: repo.forkCount,
    isForked: repo.isFork,
    languages: repo.languages.nodes.map((l) => l.name),
    topics: repo.repositoryTopics.nodes.map((t) => t.topic.name),
    pullRequests: repo.pullRequests.nodes.map(mapPullRequest),
    commits,
  };
}

/** Maps the raw contributions-collection to our flat stats shape. */
function mapContributionStats(
  c: GQLContributionsCollection
): ContributionStats {
  return {
    totalCommitContributions: c.totalCommitContributions,
    totalPullRequestContributions: c.totalPullRequestContributions,
    totalIssueContributions: c.totalIssueContributions,
    totalPullRequestReviewContributions: c.totalPullRequestReviewContributions,
    totalContributions: c.contributionCalendar.totalContributions,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch comprehensive GitHub contribution data for a user.
 *
 * Uses a single GraphQL call to retrieve the user's top 50 repositories
 * (by most-recent push), their languages, topics, merged pull requests,
 * recent commit history, and global contribution statistics.
 *
 * The function falls back gracefully — if any nested field is missing or
 * the API returns partial data, the result will contain empty arrays /
 * zeroed counters rather than throwing.
 *
 * @param token  - GitHub personal access token (PAT) or OAuth token
 * @param username - GitHub login (e.g. "octocat")
 * @returns Normalised contribution data ready for classification
 *
 * @throws {GitHubRateLimitError} when the token's rate limit is exhausted
 * @throws {Error} for unexpected network / parse failures
 */
export async function fetchContributionData(
  token: string,
  username: string
): Promise<GitHubContributionData> {
  let data: GQLUserResponse | null = null;
  const repositoryNodes: GQLRepositoryNode[] = [];
  try {
    let after: string | null = null;
    while (repositoryNodes.length < REPO_LIMIT) {
      const page: GQLUserResponse = await githubGraphQL<GQLUserResponse>(
        CONTRIBUTION_QUERY,
        token,
        {
          login: username,
          first: Math.min(REPO_PAGE_SIZE, REPO_LIMIT - repositoryNodes.length),
          after,
        }
      );
      data ??= page;
      if (!page?.user) break;
      repositoryNodes.push(...(page.user.repositories?.nodes ?? []));
      const info = page.user.repositories?.pageInfo;
      if (!info?.hasNextPage || !info.endCursor) break;
      after = info.endCursor;
    }
  } catch (err) {
    // Re-throw rate-limit errors so callers can surface retry-after info
    if (err instanceof GitHubRateLimitError) {
      throw err;
    }
    throw new Error(
      `Failed to fetch GitHub contribution data for "${username}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Guard against a missing / null user (e.g. typo in login)
  if (!data?.user) {
    throw new Error(`GitHub user "${username}" not found.`);
  }

  const { user } = data;

  // Map repositories — tolerate missing nodes gracefully
  const repositories: RepositoryData[] = repositoryNodes.map(mapRepository);

  // Map contribution stats
  const contributionStats: ContributionStats = user.contributionsCollection
    ? mapContributionStats(user.contributionsCollection)
    : {
        totalCommitContributions: 0,
        totalPullRequestContributions: 0,
        totalIssueContributions: 0,
        totalPullRequestReviewContributions: 0,
        totalContributions: 0,
      };

  return {
    user: {
      login: user.login,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    },
    repositories,
    contributionStats,
    fetchedAt: new Date().toISOString(),
  };
}
