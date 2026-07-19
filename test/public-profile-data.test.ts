import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchPublicTopRepos,
  fetchPublicContributions,
  fetchPublicStreak,
  fetchTopLanguage,
  fetchPublicGists,
} from "../src/lib/public-profile-data";

describe("public-profile-data", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchPublicTopRepos", () => {
    it("should return sorted top repositories on successful API response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { repository: { full_name: "owner/repo-a", html_url: "https://github.com/owner/repo-a" } },
            { repository: { full_name: "owner/repo-a", html_url: "https://github.com/owner/repo-a" } },
            { repository: { full_name: "owner/repo-b", html_url: "https://github.com/owner/repo-b" } },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const repos = await fetchPublicTopRepos("user123");
      expect(repos.length).toBe(2);
      expect(repos[0].name).toBe("owner/repo-a");
      expect(repos[0].commits).toBe(2);
      expect(repos[1].name).toBe("owner/repo-b");
      expect(repos[1].commits).toBe(1);
    });

    it("should return empty array on failed API response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal("fetch", mockFetch);

      const repos = await fetchPublicTopRepos("user123");
      expect(repos).toEqual([]);
    });
  });

  describe("fetchPublicGists", () => {
    it("should return the public gist count on successful API response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ public_gists: 7 }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const gists = await fetchPublicGists("user123");
      expect(gists).toBe(7);
    });

    it("should return zero on failed API response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal("fetch", mockFetch);

      const gists = await fetchPublicGists("user123");
      expect(gists).toBe(0);
    });
  });

  describe("fetchPublicContributions", () => {
    it("should aggregate commits by day on successful response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 3,
          items: [
            { commit: { author: { date: "2026-05-10T12:00:00Z" } } },
            { commit: { author: { date: "2026-05-10T15:00:00Z" } } },
            { commit: { author: { date: "2026-05-11T12:00:00Z" } } },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const contributions = await fetchPublicContributions("user123");
      expect(contributions.total).toBe(3);
      expect(contributions.data["2026-05-10"]).toBe(2);
      expect(contributions.data["2026-05-11"]).toBe(1);
    });
  });

  describe("fetchPublicStreak", () => {
    it("should compute current and longest streak correctly", async () => {
      // Mock dates: today and yesterday
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { commit: { author: { date: today } } },
            { commit: { author: { date: yesterday } } },
            { commit: { author: { date: twoDaysAgo } } },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const streak = await fetchPublicStreak("user123");
      expect(streak.current).toBe(3);
      expect(streak.longest).toBe(3);
      expect(streak.totalActiveDays).toBe(3);
    });

    it("should return zero values on failed API response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal("fetch", mockFetch);

      const streak = await fetchPublicStreak("user123");
      expect(streak.current).toBe(0);
      expect(streak.longest).toBe(0);
      expect(streak.lastCommitDate).toBeNull();
    });
  });

  describe("fetchTopLanguage", () => {
    it("should extract most frequent repository language", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { language: "TypeScript" },
          { language: "TypeScript" },
          { language: "Python" },
          { language: null },
        ],
      });
      vi.stubGlobal("fetch", mockFetch);

      const topLang = await fetchTopLanguage("user123");
      expect(topLang).toBe("TypeScript");
    });

    it("should return null on failed API response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal("fetch", mockFetch);

      const topLang = await fetchTopLanguage("user123");
      expect(topLang).toBeNull();
    });
  });
});
