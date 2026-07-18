import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filterLeaderboardByLanguage, type LeaderboardPayload } from "../src/lib/leaderboard";

describe("filterLeaderboardByLanguage", () => {
  const mockPayload: LeaderboardPayload = {
    generatedAt: "2026-06-10T12:00:00.000Z",
    refreshSeconds: 3600,
    leaders: {
      streak: [
        { id: "u1", rank: 1, username: "user1", avatarUrl: "", profileUrl: "", streak: 5, commits: 10, prs: 2, score: 41, isSponsor: false },
        { id: "u2", rank: 2, username: "user2", avatarUrl: "", profileUrl: "", streak: 4, commits: 5, prs: 1, score: 28, isSponsor: false },
      ],
      commits: [
        { id: "u1", rank: 1, username: "user1", avatarUrl: "", profileUrl: "", streak: 5, commits: 10, prs: 2, score: 41, isSponsor: false },
        { id: "u2", rank: 2, username: "user2", avatarUrl: "", profileUrl: "", streak: 4, commits: 5, prs: 1, score: 28, isSponsor: false },
      ],
      prs: [
        { id: "u1", rank: 1, username: "user1", avatarUrl: "", profileUrl: "", streak: 5, commits: 10, prs: 2, score: 41, isSponsor: false },
        { id: "u2", rank: 2, username: "user2", avatarUrl: "", profileUrl: "", streak: 4, commits: 5, prs: 1, score: 28, isSponsor: false },
      ],
    },
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns original payload if no language specified", async () => {
    const result = await filterLeaderboardByLanguage(mockPayload, "");
    expect(result).toEqual(mockPayload);
  });

  it("filters users based on language repositories", async () => {
    // Mock fetch to return repo matches for user1, but not user2
    (global.fetch as any).mockImplementation((url: string) => {
      const decodedUrl = decodeURIComponent(url);
      if (decodedUrl.includes("user:user1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [{ full_name: "user1/repo1" }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
    });

    const result = await filterLeaderboardByLanguage(mockPayload, "typescript");

    expect(result.leaders.streak).toHaveLength(1);
    expect(result.leaders.streak[0].username).toBe("user1");

    expect(result.leaders.commits).toHaveLength(1);
    expect(result.leaders.commits[0].username).toBe("user1");

    expect(result.leaders.prs).toHaveLength(1);
    expect(result.leaders.prs[0].username).toBe("user1");
  });
});
