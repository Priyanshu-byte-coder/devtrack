import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchContributionData } from "@/lib/cv/cv-github-fetcher";
import { githubGraphQL, GitHubRateLimitError } from "@/lib/github-fetch";

vi.mock("@/lib/github-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github-fetch")>();
  return {
    ...actual,
    githubGraphQL: vi.fn(),
  };
});

function createMockRepo(index: number) {
  return {
    name: `repo-${index}`,
    nameWithOwner: `octocat/repo-${index}`,
    description: `Description for repo ${index}`,
    url: `https://github.com/octocat/repo-${index}`,
    stargazerCount: 10 + index,
    forkCount: 2 + index,
    isFork: false,
    languages: {
      nodes: [{ name: "TypeScript" }, { name: "JavaScript" }],
    },
    repositoryTopics: {
      nodes: [{ topic: { name: "react" } }, { topic: { name: "nextjs" } }],
    },
    pullRequests: {
      nodes: [
        {
          title: `PR ${index}`,
          body: `Body ${index}`,
          additions: 100,
          deletions: 20,
          changedFiles: 5,
          state: "MERGED" as const,
          mergedAt: "2026-05-01T12:00:00Z",
          createdAt: "2026-04-28T10:00:00Z",
          labels: { nodes: [{ name: "enhancement" }] },
        },
      ],
    },
    defaultBranchRef: {
      target: {
        history: {
          nodes: [
            {
              message: `Initial commit for repo ${index}`,
              committedDate: "2026-05-02T15:00:00Z",
            },
          ],
        },
      },
    },
  };
}

describe("cv-github-fetcher", () => {
  const mockToken = "mock-pat-token";
  const mockUsername = "octocat";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetches and maps comprehensive single-page contribution data", async () => {
    const mockResponse = {
      user: {
        login: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        bio: "Open source developer and maintainer.",
        repositories: {
          nodes: [createMockRepo(1), createMockRepo(2)],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
        contributionsCollection: {
          totalCommitContributions: 150,
          totalPullRequestContributions: 25,
          totalIssueContributions: 10,
          totalPullRequestReviewContributions: 15,
          contributionCalendar: {
            totalContributions: 200,
          },
        },
      },
    };

    vi.mocked(githubGraphQL).mockResolvedValueOnce(mockResponse);

    const result = await fetchContributionData(mockToken, mockUsername);

    expect(githubGraphQL).toHaveBeenCalledTimes(1);
    expect(result.user).toEqual({
      login: "octocat",
      avatarUrl: "https://github.com/octocat.png",
      bio: "Open source developer and maintainer.",
    });

    expect(result.repositories).toHaveLength(2);
    const repo1 = result.repositories[0];
    expect(repo1.name).toBe("repo-1");
    expect(repo1.nameWithOwner).toBe("octocat/repo-1");
    expect(repo1.description).toBe("Description for repo 1");
    expect(repo1.stargazerCount).toBe(11);
    expect(repo1.forkCount).toBe(3);
    expect(repo1.isForked).toBe(false);
    expect(repo1.languages).toEqual(["TypeScript", "JavaScript"]);
    expect(repo1.topics).toEqual(["react", "nextjs"]);

    expect(repo1.pullRequests).toHaveLength(1);
    expect(repo1.pullRequests[0]).toEqual({
      title: "PR 1",
      body: "Body 1",
      additions: 100,
      deletions: 20,
      changedFiles: 5,
      state: "MERGED",
      mergedAt: "2026-05-01T12:00:00Z",
      createdAt: "2026-04-28T10:00:00Z",
      labels: ["enhancement"],
    });

    expect(repo1.commits).toHaveLength(1);
    expect(repo1.commits[0]).toEqual({
      message: "Initial commit for repo 1",
      committedDate: "2026-05-02T15:00:00Z",
      additions: 0,
      deletions: 0,
    });

    expect(result.contributionStats).toEqual({
      totalCommitContributions: 150,
      totalPullRequestContributions: 25,
      totalIssueContributions: 10,
      totalPullRequestReviewContributions: 15,
      totalContributions: 200,
    });

    expect(new Date(result.fetchedAt).toISOString()).toBe(result.fetchedAt);
  });

  it("handles empty repository collection gracefully", async () => {
    const mockResponse = {
      user: {
        login: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        bio: null,
        repositories: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
        contributionsCollection: {
          totalCommitContributions: 0,
          totalPullRequestContributions: 0,
          totalIssueContributions: 0,
          totalPullRequestReviewContributions: 0,
          contributionCalendar: {
            totalContributions: 0,
          },
        },
      },
    };

    vi.mocked(githubGraphQL).mockResolvedValueOnce(mockResponse);

    const result = await fetchContributionData(mockToken, mockUsername);

    expect(result.repositories).toEqual([]);
    expect(result.user.login).toBe("octocat");
    expect(result.contributionStats.totalContributions).toBe(0);
  });

  it("paginates repository queries and accumulates repositories across pages", async () => {
    const page1Repos = Array.from({ length: 10 }, (_, i) =>
      createMockRepo(i + 1)
    );
    const page2Repos = Array.from({ length: 5 }, (_, i) =>
      createMockRepo(i + 11)
    );

    const page1Response = {
      user: {
        login: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        bio: null,
        repositories: {
          nodes: page1Repos,
          pageInfo: {
            hasNextPage: true,
            endCursor: "cursor_page_1",
          },
        },
        contributionsCollection: {
          totalCommitContributions: 50,
          totalPullRequestContributions: 10,
          totalIssueContributions: 5,
          totalPullRequestReviewContributions: 2,
          contributionCalendar: { totalContributions: 67 },
        },
      },
    };

    const page2Response = {
      user: {
        login: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        bio: null,
        repositories: {
          nodes: page2Repos,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
        contributionsCollection: {
          totalCommitContributions: 50,
          totalPullRequestContributions: 10,
          totalIssueContributions: 5,
          totalPullRequestReviewContributions: 2,
          contributionCalendar: { totalContributions: 67 },
        },
      },
    };

    vi.mocked(githubGraphQL)
      .mockResolvedValueOnce(page1Response)
      .mockResolvedValueOnce(page2Response);

    const result = await fetchContributionData(mockToken, mockUsername);

    expect(githubGraphQL).toHaveBeenCalledTimes(2);

    expect(githubGraphQL).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      mockToken,
      {
        login: mockUsername,
        first: 10,
        after: null,
      }
    );

    expect(githubGraphQL).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      mockToken,
      {
        login: mockUsername,
        first: 10,
        after: "cursor_page_1",
      }
    );

    expect(result.repositories).toHaveLength(15);
    expect(result.repositories[0].name).toBe("repo-1");
    expect(result.repositories[14].name).toBe("repo-15");
  });

  it("enforces maximum repository cap of 50 repositories", async () => {
    // Generate 6 pages of 10 repos each with hasNextPage: true
    const createPage = (startIdx: number, cursor: string) => ({
      user: {
        login: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        bio: null,
        repositories: {
          nodes: Array.from({ length: 10 }, (_, i) =>
            createMockRepo(startIdx + i)
          ),
          pageInfo: {
            hasNextPage: true,
            endCursor: cursor,
          },
        },
        contributionsCollection: {
          totalCommitContributions: 100,
          totalPullRequestContributions: 10,
          totalIssueContributions: 5,
          totalPullRequestReviewContributions: 5,
          contributionCalendar: { totalContributions: 120 },
        },
      },
    });

    vi.mocked(githubGraphQL)
      .mockResolvedValueOnce(createPage(1, "c1"))
      .mockResolvedValueOnce(createPage(11, "c2"))
      .mockResolvedValueOnce(createPage(21, "c3"))
      .mockResolvedValueOnce(createPage(31, "c4"))
      .mockResolvedValueOnce(createPage(41, "c5"));

    const result = await fetchContributionData(mockToken, mockUsername);

    // Loop must terminate at 50 repositories (5 requests), without making a 6th request
    expect(githubGraphQL).toHaveBeenCalledTimes(5);
    expect(result.repositories).toHaveLength(50);
  });

  it("falls back to zeroed contribution stats when contributionsCollection is null or missing", async () => {
    const mockResponse = {
      user: {
        login: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        bio: null,
        repositories: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
        contributionsCollection: null,
      },
    };

    vi.mocked(githubGraphQL).mockResolvedValueOnce(mockResponse as any);

    const result = await fetchContributionData(mockToken, mockUsername);

    expect(result.contributionStats).toEqual({
      totalCommitContributions: 0,
      totalPullRequestContributions: 0,
      totalIssueContributions: 0,
      totalPullRequestReviewContributions: 0,
      totalContributions: 0,
    });
  });

  it("maps empty commits array when defaultBranchRef is null", async () => {
    const repoWithoutDefaultBranch = {
      ...createMockRepo(1),
      defaultBranchRef: null,
    };

    const mockResponse = {
      user: {
        login: "octocat",
        avatarUrl: "https://github.com/octocat.png",
        bio: null,
        repositories: {
          nodes: [repoWithoutDefaultBranch],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
        contributionsCollection: {
          totalCommitContributions: 10,
          totalPullRequestContributions: 2,
          totalIssueContributions: 1,
          totalPullRequestReviewContributions: 0,
          contributionCalendar: { totalContributions: 13 },
        },
      },
    };

    vi.mocked(githubGraphQL).mockResolvedValueOnce(mockResponse);

    const result = await fetchContributionData(mockToken, mockUsername);

    expect(result.repositories).toHaveLength(1);
    expect(result.repositories[0].commits).toEqual([]);
  });

  it("throws specific not found error when user is null", async () => {
    vi.mocked(githubGraphQL).mockResolvedValueOnce({ user: null });

    await expect(
      fetchContributionData(mockToken, "unknown-user")
    ).rejects.toThrow('GitHub user "unknown-user" not found.');
  });

  it("propagates GitHubRateLimitError without generic wrapping", async () => {
    const rateLimitError = new GitHubRateLimitError(
      new Date(Date.now() + 60000),
      60
    );
    vi.mocked(githubGraphQL).mockRejectedValueOnce(rateLimitError);

    await expect(
      fetchContributionData(mockToken, mockUsername)
    ).rejects.toThrow(GitHubRateLimitError);
  });

  it("wraps generic network errors with descriptive context message", async () => {
    vi.mocked(githubGraphQL).mockRejectedValueOnce(
      new Error("ETIMEDOUT connection failed")
    );

    await expect(
      fetchContributionData(mockToken, mockUsername)
    ).rejects.toThrow(
      'Failed to fetch GitHub contribution data for "octocat": ETIMEDOUT connection failed'
    );
  });

  it("converts and wraps non-Error rejections gracefully", async () => {
    vi.mocked(githubGraphQL).mockRejectedValueOnce("Service Unavailable 503");

    await expect(
      fetchContributionData(mockToken, mockUsername)
    ).rejects.toThrow(
      'Failed to fetch GitHub contribution data for "octocat": Service Unavailable 503'
    );
  });
});
