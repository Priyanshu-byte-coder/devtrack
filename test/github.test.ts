import { describe, it, expect } from "vitest";
import type {
  GitHubEvent,
  GitHubRepo,
  GitHubCommitSearchItem,
  CommitItem,
  GitHubIssueItem,
  IssuesMetrics,
} from "../src/lib/github";

describe("github types and interfaces", () => {
  describe("GitHubEvent", () => {
    it("accepts valid event structure", () => {
      const event: GitHubEvent = {
        id: "123",
        type: "PushEvent",
        created_at: "2024-01-15T10:00:00Z",
        repo: { name: "owner/repo" },
      };
      expect(event.id).toBe("123");
      expect(event.type).toBe("PushEvent");
    });
  });

  describe("GitHubRepo", () => {
    it("accepts valid repo structure", () => {
      const repo: GitHubRepo = {
        id: 123,
        name: "repo",
        full_name: "owner/repo",
        html_url: "https://github.com/owner/repo",
        private: false,
        visibility: "public",
        open_issues_count: 5,
        stargazers_count: 100,
        pushed_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
	created_at: "2024-01-01T00:00:00Z",
        language: "TypeScript",

      };
      expect(repo.full_name).toBe("owner/repo");
      expect(repo.visibility).toBe("public");
    });

    it("accepts repo with optional archived field", () => {
      const repo: GitHubRepo = {
        id: 123,
        name: "repo",
        full_name: "owner/repo",
        html_url: "https://github.com/owner/repo",
        private: false,
        open_issues_count: 0,
        stargazers_count: 0,
        pushed_at: null,
	created_at: "2024-01-01T00:00:00Z",
        language: null,
        updated_at: "2024-01-15T10:00:00Z",
        archived: true,
      };
      expect(repo.archived).toBe(true);
    });
  });

  describe("GitHubCommitSearchItem", () => {
    it("accepts valid commit search item", () => {
      const item: GitHubCommitSearchItem = {
        sha: "abc123",
        commit: {
          author: { date: "2024-01-15T10:00:00Z" },
          message: "Initial commit",
        },
        repository: { full_name: "owner/repo" },
        html_url: "https://github.com/owner/repo/commit/abc123",
      };
      expect(item.sha).toBe("abc123");
      expect(item.commit.message).toBe("Initial commit");
    });
  });

  describe("CommitItem", () => {
    it("accepts valid commit item", () => {
      const item: CommitItem = {
        sha: "abc123",
        message: "Initial commit",
        date: "2024-01-15T10:00:00Z",
        repo: "owner/repo",
        url: "https://github.com/owner/repo/commit/abc123",
      };
      expect(item.repo).toBe("owner/repo");
    });
  });

  describe("GitHubIssueItem", () => {
    it("accepts open issue", () => {
      const item: GitHubIssueItem = {
        state: "open",
        created_at: "2024-01-15T10:00:00Z",
        closed_at: null,
        repository_url: "https://api.github.com/repos/owner/repo",
      };
      expect(item.state).toBe("open");
      expect(item.closed_at).toBeNull();
    });

    it("accepts closed issue", () => {
      const item: GitHubIssueItem = {
        state: "closed",
        created_at: "2024-01-15T10:00:00Z",
        closed_at: "2024-01-16T10:00:00Z",
        repository_url: "https://api.github.com/repos/owner/repo",
      };
      expect(item.state).toBe("closed");
      expect(item.closed_at).toBe("2024-01-16T10:00:00Z");
    });
  });

  describe("IssuesMetrics", () => {
    it("accepts valid metrics structure", () => {
      const metrics: IssuesMetrics = {
        opened: 10,
        closed: 5,
        currentlyOpen: 3,
        avgCloseTimeDays: 2.5,
        trend: 2,
        mostActiveRepo: "owner/repo",
      };
      expect(metrics.opened).toBe(10);
      expect(metrics.trend).toBe(2);
    });

    it("accepts metrics with null mostActiveRepo", () => {
      const metrics: IssuesMetrics = {
        opened: 0,
        closed: 0,
        currentlyOpen: 0,
        avgCloseTimeDays: 0,
        trend: 0,
        mostActiveRepo: null,
      };
      expect(metrics.mostActiveRepo).toBeNull();
    });
  });
});
