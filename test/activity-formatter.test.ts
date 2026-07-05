import { describe, it, expect } from "vitest";
import {
  formatActivity,
  formatGraphQLDiscussionComment,
  mergeActivityItems,
} from "@/lib/activity-formatter";
import type { RawEvent } from "@/lib/activity-formatter";

describe("formatActivity", () => {
  it("returns null when repo name is missing", () => {
    const event: RawEvent = {
      id: "1",
      type: "PushEvent",
      created_at: "2024-01-01T00:00:00Z",
    };
    expect(formatActivity(event)).toBeNull();
  });

  it("returns null for unsupported event type", () => {
    const event: RawEvent = {
      id: "1",
      type: "ForkEvent",
      created_at: "2024-01-01T00:00:00Z",
      repo: { name: "owner/repo" },
    };
    expect(formatActivity(event)).toBeNull();
  });

  describe("PushEvent", () => {
    it("formats a single-commit push", () => {
      const event: RawEvent = {
        id: "push1",
        type: "PushEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          ref: "refs/heads/main",
          head: "abc1234",
          commits: [{ sha: "abc1234" }],
        },
      };
      const result = formatActivity(event);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("push");
      expect(result!.title).toBe("Pushed 1 commit to main");
      expect(result!.url).toBe("https://github.com/owner/repo/commit/abc1234");
    });

    it("formats a multi-commit push", () => {
      const event: RawEvent = {
        id: "push2",
        type: "PushEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          ref: "refs/heads/main",
          commits: [{ sha: "a" }, { sha: "b" }, { sha: "c" }],
        },
      };
      const result = formatActivity(event);
      expect(result!.title).toBe("Pushed 3 commits to main");
    });

    it("handles missing ref as default branch", () => {
      const event: RawEvent = {
        id: "push3",
        type: "PushEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: { commits: [] },
      };
      const result = formatActivity(event);
      expect(result!.title).toBe("Pushed 0 commits to default branch");
    });

    it("strips refs/heads/ prefix from branch name", () => {
      const event: RawEvent = {
        id: "push4",
        type: "PushEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: { ref: "refs/heads/feature/my-branch", commits: [{}] },
      };
      expect(formatActivity(event)!.title).toContain("feature/my-branch");
    });
  });

  describe("PullRequestEvent", () => {
    it("formats an opened PR", () => {
      const event: RawEvent = {
        id: "pr1",
        type: "PullRequestEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          action: "opened",
          pull_request: {
            number: 42,
            title: "Add feature X",
            html_url: "https://github.com/owner/repo/pull/42",
          },
        },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("pull_request");
      expect(result!.title).toBe("Opened pull request #42");
      expect(result!.subtitle).toBe("Add feature X");
    });

    it("formats a merged PR", () => {
      const event: RawEvent = {
        id: "pr2",
        type: "PullRequestEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          action: "closed",
          pull_request: {
            number: 43,
            merged: true,
            html_url: "https://github.com/owner/repo/pull/43",
          },
        },
      };
      expect(formatActivity(event)!.title).toBe("Merged pull request #43");
    });

    it("capitalizes close action", () => {
      const event: RawEvent = {
        id: "pr3",
        type: "PullRequestEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          action: "closed",
          pull_request: { merged: false, number: 44 },
        },
      };
      expect(formatActivity(event)!.title).toBe("Closed pull request #44");
    });
  });

  describe("IssuesEvent", () => {
    it("formats an opened issue", () => {
      const event: RawEvent = {
        id: "issue1",
        type: "IssuesEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          action: "opened",
          issue: {
            number: 10,
            title: "Bug in login",
            html_url: "https://github.com/owner/repo/issues/10",
          },
        },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("issue");
      expect(result!.title).toBe("Opened issue #10");
      expect(result!.subtitle).toBe("Bug in login");
    });
  });

  describe("ReleaseEvent", () => {
    it("formats a published release", () => {
      const event: RawEvent = {
        id: "rel1",
        type: "ReleaseEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          action: "published",
          release: {
            tag_name: "v1.0.0",
            name: "Version 1.0.0",
            html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
          },
        },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("release");
      expect(result!.title).toBe("Published v1.0.0");
      expect(result!.subtitle).toBe("Version 1.0.0");
    });
  });

  describe("WatchEvent (star)", () => {
    it("formats a starred repo", () => {
      const event: RawEvent = {
        id: "star1",
        type: "WatchEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("star");
      expect(result!.title).toBe("Starred owner/repo");
      expect(result!.url).toBe("https://github.com/owner/repo");
    });
  });

  describe("DiscussionEvent", () => {
    it("formats an opened discussion", () => {
      const event: RawEvent = {
        id: "disc1",
        type: "DiscussionEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          action: "opened",
          discussion: {
            number: 5,
            title: "How to contribute",
            html_url: "https://github.com/owner/repo/discussions/5",
          },
        },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("discussion");
      expect(result!.title).toBe("Opened discussion #5");
      expect(result!.subtitle).toBe("How to contribute");
    });
  });

  describe("PullRequestReviewEvent", () => {
    it("formats a PR review", () => {
      const event: RawEvent = {
        id: "review1",
        type: "PullRequestReviewEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          pull_request: {
            number: 7,
            title: "Fix bug",
            html_url: "https://github.com/owner/repo/pull/7",
          },
        },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("review");
      expect(result!.title).toBe("Reviewed PR #7");
      expect(result!.subtitle).toBe("Fix bug");
    });
  });

  describe("CreateEvent", () => {
    it("formats branch creation", () => {
      const event: RawEvent = {
        id: "create1",
        type: "CreateEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: { ref_type: "branch", ref: "feature/new" },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("create");
      expect(result!.title).toBe('Created branch "feature/new"');
    });

    it("formats tag creation", () => {
      const event: RawEvent = {
        id: "create2",
        type: "CreateEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: { ref_type: "tag", ref: "v1.0.0" },
      };
      const result = formatActivity(event);
      expect(result!.title).toBe('Created tag "v1.0.0"');
    });
  });

  describe("DiscussionCommentEvent", () => {
    it("formats a discussion comment", () => {
      const event: RawEvent = {
        id: "dc1",
        type: "DiscussionCommentEvent",
        created_at: "2024-01-01T10:00:00Z",
        repo: { name: "owner/repo" },
        payload: {
          discussion: {
            number: 3,
            title: "Help needed",
            html_url: "https://github.com/owner/repo/discussions/3",
          },
        },
      };
      const result = formatActivity(event);
      expect(result!.type).toBe("discussion");
      expect(result!.title).toBe("Commented on discussion #3");
    });
  });
});

describe("formatGraphQLDiscussionComment", () => {
  it("normalizes a GraphQL discussion comment node", () => {
    const node = {
      createdAt: "2024-01-01T12:00:00Z",
      url: "https://github.com/owner/repo/discussions/5#discussioncomment-1",
      discussion: {
        title: "Help with setup",
        number: 5,
        url: "https://github.com/owner/repo/discussions/5",
        repository: { nameWithOwner: "owner/repo" },
      },
    };
    const result = formatGraphQLDiscussionComment(node);
    expect(result.type).toBe("discussion");
    expect(result.createdAt).toBe("2024-01-01T12:00:00Z");
    expect(result.title).toBe("Commented on discussion #5");
    expect(result.subtitle).toBe("Help with setup");
    expect(result.repo).toBe("owner/repo");
    expect(result.url).toBe("https://github.com/owner/repo/discussions/5");
  });
});

describe("mergeActivityItems", () => {
  const restItem = {
    id: "rest1",
    type: "push" as const,
    createdAt: "2024-01-01T10:00:00Z",
    title: "Pushed 1 commit",
    subtitle: "owner/repo",
    repo: "owner/repo",
    url: "https://github.com/owner/repo",
  };

  const gqlItem = {
    id: "gql1",
    type: "discussion" as const,
    createdAt: "2024-01-01T12:00:00Z",
    title: "Commented on discussion #5",
    subtitle: "Help",
    repo: "owner/repo",
    url: "https://github.com/owner/repo/discussions/5",
  };

  it("merges and sorts by createdAt descending", () => {
    const result = mergeActivityItems([restItem], [gqlItem]);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe("gql1"); // newer
    expect(result[1].id).toBe("rest1");
  });

  it("deduplicates items with same type-repo-createdAt-title", () => {
    const duplicate: typeof restItem = {
      ...restItem,
      id: "rest2",
    };
    const result = mergeActivityItems([restItem, duplicate], []);
    expect(result.length).toBe(1);
    // last item with matching key wins (Map overwrites on duplicate key)
    expect(result[0].id).toBe("rest2");
  });

  it("handles empty inputs", () => {
    expect(mergeActivityItems([], [])).toEqual([]);
    expect(mergeActivityItems([restItem], [])).toHaveLength(1);
    expect(mergeActivityItems([], [gqlItem])).toHaveLength(1);
  });
});
