import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCIAnalyticsForAccount, mergeCIAnalytics, CIAnalyticsResponse } from "../src/lib/ci-analytics";

// Mock the route's dependencies to prevent resolution failures during import
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: {} as any }));
vi.mock("@/lib/github-accounts", () => ({
  getAccountToken: vi.fn(),
  getAllAccounts: vi.fn(),
  mergeMetrics: vi.fn(),
}));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: vi.fn() }));
vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: vi.fn(),
  metricsCacheKey: vi.fn(),
  withMetricsCache: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

describe("CI Metrics Route Helpers", () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorSpy.mockRestore();
  });

  describe("fetchCIAnalyticsForAccount", () => {
    it("should compile CI analytics when all repo requests succeed", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/search/commits")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                { repository: { full_name: "user/repo-a" } },
                { repository: { full_name: "user/repo-b" } },
              ],
            }),
          });
        }
        if (url.includes("/repos/user/repo-a/actions/runs") || url.includes("/repos/user/repo-b/actions/runs")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              workflow_runs: [
                {
                  conclusion: "success",
                  created_at: "2026-05-20T10:00:00Z",
                  name: "CI Workflow",
                  updated_at: "2026-05-20T10:05:00Z",
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchCIAnalyticsForAccount("fake-token", "user");
      expect(result.successRate).toBe(100);
      expect(result.averageDurationMinutes).toBe(5);
      expect(result.totalRuns).toBe(2);
      expect(result.reposChecked).toBe(2);
      expect(result.failedRepos).toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should handle partial failures gracefully when some repo fetches throw an error", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/search/commits")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                { repository: { full_name: "user/repo-a" } },
                { repository: { full_name: "user/repo-b" } },
              ],
            }),
          });
        }
        if (url.includes("/repos/user/repo-a/actions/runs")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              workflow_runs: [
                {
                  conclusion: "success",
                  created_at: "2026-05-20T10:00:00Z",
                  name: "CI Workflow",
                  updated_at: "2026-05-20T10:05:00Z",
                },
              ],
            }),
          });
        }
        if (url.includes("/repos/user/repo-b/actions/runs")) {
          return Promise.reject(new Error("GitHub API Connection timeout"));
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchCIAnalyticsForAccount("fake-token", "user");
      
      // Should aggregate only the successful one (repo-a)
      expect(result.successRate).toBe(100);
      expect(result.averageDurationMinutes).toBe(5);
      expect(result.totalRuns).toBe(1);
      expect(result.reposChecked).toBe(2);
      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain("Failed to fetch signals for repo user/repo-b:");
      // Should track the failed repository in the failedRepos metadata field
      expect(result.failedRepos).toEqual(["user/repo-b"]);
    });

    it("should handle non-ok responses that trigger throw (like 500) gracefully", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/search/commits")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                { repository: { full_name: "user/repo-a" } },
              ],
            }),
          });
        }
        if (url.includes("/repos/user/repo-a/actions/runs")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchCIAnalyticsForAccount("fake-token", "user");
      
      expect(result.successRate).toBe(0);
      expect(result.totalRuns).toBe(0);
      expect(result.reposChecked).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.failedRepos).toEqual(["user/repo-a"]);
    });

    it("should ignore 404 and 403 status codes without recording them as failedRepos", async () => {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/search/commits")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                { repository: { full_name: "user/repo-a" } },
                { repository: { full_name: "user/repo-b" } },
              ],
            }),
          });
        }
        if (url.includes("/repos/user/repo-a/actions/runs")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              workflow_runs: [
                {
                  conclusion: "success",
                  created_at: "2026-05-20T10:00:00Z",
                  name: "CI Workflow",
                  updated_at: "2026-05-20T10:05:00Z",
                },
              ],
            }),
          });
        }
        if (url.includes("/repos/user/repo-b/actions/runs")) {
          return Promise.resolve({
            ok: false,
            status: 404,
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await fetchCIAnalyticsForAccount("fake-token", "user");
      
      expect(result.successRate).toBe(100);
      expect(result.totalRuns).toBe(1);
      expect(result.reposChecked).toBe(2);
      expect(result.failedRepos).toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("mergeCIAnalytics", () => {
    it("should merge two CI analytics objects correctly including failedRepos", () => {
      const a: CIAnalyticsResponse = {
        successRate: 80,
        averageDurationMinutes: 10,
        flakiestWorkflow: "workflow-a",
        totalRuns: 10,
        reposChecked: 3,
        failedRepos: ["user/repo-c"],
      };

      const b: CIAnalyticsResponse = {
        successRate: 90,
        averageDurationMinutes: 8,
        flakiestWorkflow: "workflow-b",
        totalRuns: 20,
        reposChecked: 2,
        failedRepos: ["user/repo-d", "user/repo-e"],
      };

      const merged = mergeCIAnalytics(a, b);

      expect(merged.successRate).toBe(87);
      expect(merged.averageDurationMinutes).toBe(8.7);
      expect(merged.flakiestWorkflow).toBe("workflow-a");
      expect(merged.totalRuns).toBe(30);
      expect(merged.reposChecked).toBe(5);
      expect(merged.failedRepos).toEqual(["user/repo-c", "user/repo-d", "user/repo-e"]);
    });

    it("should handle missing failedRepos fields", () => {
      const a: CIAnalyticsResponse = {
        successRate: 100,
        averageDurationMinutes: 5,
        flakiestWorkflow: null,
        totalRuns: 5,
        reposChecked: 1,
      };

      const b: CIAnalyticsResponse = {
        successRate: 100,
        averageDurationMinutes: 5,
        flakiestWorkflow: null,
        totalRuns: 5,
        reposChecked: 1,
      };

      const merged = mergeCIAnalytics(a, b);
      expect(merged.failedRepos).toEqual([]);
    });
  });
});
