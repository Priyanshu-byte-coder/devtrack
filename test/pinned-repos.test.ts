import { describe, it, expect, vi, beforeEach } from "vitest";

describe("pinned-repos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LANGUAGE_COLORS", () => {
    it("maps TypeScript to correct color", async () => {
      const { fetchPinnedRepoDetails } = await import("../src/lib/pinned-repos");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          description: "Test repo",
          html_url: "https://github.com/test/repo",
          stargazers_count: 100,
          forks_count: 10,
          language: "TypeScript",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchPinnedRepoDetails("testuser", ["test/repo"], "fake-token");
      expect(result).toHaveLength(1);
      expect(result[0].primaryLanguage).toEqual({ name: "TypeScript", color: "#3178c6" });
    });

    it("handles unknown language with default color", async () => {
      const { fetchPinnedRepoDetails } = await import("../src/lib/pinned-repos");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          description: "Test repo",
          html_url: "https://github.com/test/repo",
          stargazers_count: 100,
          forks_count: 10,
          language: "UnknownLang",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchPinnedRepoDetails("testuser", ["test/repo"], "fake-token");
      expect(result).toHaveLength(1);
      expect(result[0].primaryLanguage).toEqual({ name: "UnknownLang", color: "#8b949e" });
    });

    it("handles null language", async () => {
      const { fetchPinnedRepoDetails } = await import("../src/lib/pinned-repos");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          description: "Test repo",
          html_url: "https://github.com/test/repo",
          stargazers_count: 100,
          forks_count: 10,
          language: null,
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchPinnedRepoDetails("testuser", ["test/repo"], "fake-token");
      expect(result).toHaveLength(1);
      expect(result[0].primaryLanguage).toBeNull();
    });

    it("returns empty array for no pinned repos", async () => {
      const { fetchPinnedRepoDetails } = await import("../src/lib/pinned-repos");
      const result = await fetchPinnedRepoDetails("testuser", [], "fake-token");
      expect(result).toHaveLength(0);
    });

    it("gracefully handles 404 response", async () => {
      const { fetchPinnedRepoDetails } = await import("../src/lib/pinned-repos");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchPinnedRepoDetails("testuser", ["private/repo"], "fake-token");
      expect(result).toHaveLength(0);
    });

    it("gracefully handles 403 response", async () => {
      const { fetchPinnedRepoDetails } = await import("../src/lib/pinned-repos");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchPinnedRepoDetails("testuser", ["private/repo"], "fake-token");
      expect(result).toHaveLength(0);
    });
  });
});
