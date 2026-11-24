// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/github-request", () => ({
  githubRequest: vi.fn(),
}));

import { fetchOrgAnalytics } from "../src/lib/org-analytics";
import { githubRequest } from "../src/lib/github-request";

describe("fetchOrgAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the organization is not found (404)", async () => {
    vi.mocked(githubRequest).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    } as unknown as Response);

    const result = await fetchOrgAnalytics("nonexistent-org-404");
    expect(result).toBeNull();
  });

  it("successfully parses org metadata and public members", async () => {
    const mockOrg = {
      login: "acme-corp",
      name: "Acme Corporation",
      avatar_url: "https://github.com/acme.png",
      description: "Building the future of developer tools",
      blog: "https://acme.example.com",
      public_repos: 42,
      html_url: "https://github.com/acme-corp",
    };

    const mockMembers = [
      {
        login: "alice",
        id: 101,
        avatar_url: "https://avatars.githubusercontent.com/u/101",
        html_url: "https://github.com/alice",
      },
      {
        login: "bob",
        id: 102,
        avatar_url: "https://avatars.githubusercontent.com/u/102",
        html_url: "https://github.com/bob",
      },
      {
        login: "charlie",
        id: 103,
        avatar_url: "https://avatars.githubusercontent.com/u/103",
        html_url: "https://github.com/charlie",
      },
    ];

    vi.mocked(githubRequest)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOrg,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMembers,
      } as unknown as Response);

    const result = await fetchOrgAnalytics("acme-corp");
    expect(result).not.toBeNull();
    expect(result?.org.login).toBe("acme-corp");
    expect(result?.org.name).toBe("Acme Corporation");
    expect(result?.members).toHaveLength(3);
    expect(result?.stats.totalMembers).toBe(3);
    expect(result?.stats.totalCommits30d).toBeGreaterThan(0);
    expect(result?.stats.activeContributors).toBeGreaterThanOrEqual(1);
    expect(result?.stats.streakLeaderboard).toHaveLength(3);
    expect(result?.stats.prVelocity).toBeDefined();
  });

  it("handles organizations with zero public members gracefully", async () => {
    const mockOrg = {
      login: "empty-org",
      name: "Empty Org",
      avatar_url: "",
      description: null,
      blog: null,
      public_repos: 0,
      html_url: "https://github.com/empty-org",
    };

    vi.mocked(githubRequest)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockOrg,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as unknown as Response);

    const result = await fetchOrgAnalytics("empty-org");
    expect(result).not.toBeNull();
    expect(result?.members).toHaveLength(0);
    expect(result?.stats.totalMembers).toBe(0);
    expect(result?.stats.totalCommits30d).toBe(0);
    expect(result?.stats.activeContributors).toBe(0);
    expect(result?.stats.streakLeaderboard).toHaveLength(0);
    expect(result?.stats.prVelocity.total).toBe(0);
  });
});
