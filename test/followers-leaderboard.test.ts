// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/github-request", () => ({
  githubRequest: vi.fn(),
}));

import { fetchFollowersLeaderboard } from "../src/lib/followers-leaderboard";
import { githubRequest } from "../src/lib/github-request";

describe("fetchFollowersLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user is not found on GitHub (404)", async () => {
    vi.mocked(githubRequest).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    } as unknown as Response);

    const result = await fetchFollowersLeaderboard("nonexistent-user-404");
    expect(result).toBeNull();
  });

  it("ranks followers by streak descending by default", async () => {
    const mockFollowers = [
      {
        login: "dev1",
        id: 1,
        avatar_url: "https://avatars.githubusercontent.com/u/1",
        html_url: "https://github.com/dev1",
      },
      {
        login: "dev2",
        id: 2,
        avatar_url: "https://avatars.githubusercontent.com/u/2",
        html_url: "https://github.com/dev2",
      },
      {
        login: "dev3",
        id: 3,
        avatar_url: "https://avatars.githubusercontent.com/u/3",
        html_url: "https://github.com/dev3",
      },
    ];

    vi.mocked(githubRequest).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockFollowers,
    } as unknown as Response);

    const result = await fetchFollowersLeaderboard("sampleuser", "streak");
    expect(result).not.toBeNull();
    expect(result?.totalFollowers).toBe(3);
    expect(result?.sortBy).toBe("streak");
    expect(result?.followers[0].rank).toBe(1);
    expect(result?.followers[1].rank).toBe(2);
    expect(result?.followers[2].rank).toBe(3);

    // Streaks should be ordered monotonically non-increasing
    expect(result!.followers[0].currentStreak).toBeGreaterThanOrEqual(
      result!.followers[1].currentStreak
    );
    expect(result!.followers[1].currentStreak).toBeGreaterThanOrEqual(
      result!.followers[2].currentStreak
    );
  });

  it("supports sorting by commits", async () => {
    const mockFollowers = [
      {
        login: "alpha",
        id: 11,
        avatar_url: "https://avatars.githubusercontent.com/u/11",
        html_url: "https://github.com/alpha",
      },
      {
        login: "beta",
        id: 12,
        avatar_url: "https://avatars.githubusercontent.com/u/12",
        html_url: "https://github.com/beta",
      },
    ];

    vi.mocked(githubRequest).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockFollowers,
    } as unknown as Response);

    const result = await fetchFollowersLeaderboard("sortuser", "commits");
    expect(result).not.toBeNull();
    expect(result?.sortBy).toBe("commits");
    expect(result!.followers[0].commitsThisMonth).toBeGreaterThanOrEqual(
      result!.followers[1].commitsThisMonth
    );
  });
});
