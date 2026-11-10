/**
 * buildDigestMetrics: the week's commits must be complete; streak, languages,
 * top repos and PRs are best-effort so one slow or partial GitHub lookup
 * doesn't strip every number from the email.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streak: vi.fn(),
  contributions: vi.fn(),
  languages: vi.fn(),
  repos: vi.fn(),
  githubRequest: vi.fn(),
}));

vi.mock("@/lib/public-profile-data", () => ({
  fetchPublicStreak: mocks.streak,
  fetchPublicContributions: mocks.contributions,
  fetchPublicTopLanguages: mocks.languages,
  fetchPublicTopRepos: mocks.repos,
}));
vi.mock("@/lib/github-request", () => ({ githubRequest: mocks.githubRequest }));

import { buildDigestMetrics } from "@/lib/weekly-digest";

const week = {
  days: 7,
  total: 12,
  data: { "2026-11-09": 5, "2026-11-10": 7 },
  complete: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.contributions.mockResolvedValue(week);
  mocks.streak.mockResolvedValue({
    current: 4,
    longest: 9,
    lastCommitDate: "2026-11-10",
    complete: true,
  });
  mocks.languages.mockResolvedValue([{ name: "TypeScript", percentage: 70 }]);
  mocks.repos.mockResolvedValue([{ name: "a/b", commits: 12, url: "u" }]);
  mocks.githubRequest.mockResolvedValue({
    ok: true,
    json: async () => ({ total_count: 2 }),
  });
});

describe("buildDigestMetrics", () => {
  it("returns every metric when all lookups succeed", async () => {
    const m = await buildDigestMetrics("octocat", "t");
    expect(m).toMatchObject({
      weeklyCommits: 12,
      weeklyActiveDays: 2,
      prsThisWeek: 2,
      streak: { current: 4, longest: 9 },
    });
    expect(m.topRepos).toHaveLength(1);
  });

  it("keeps the numbers when top repos, languages and PRs fail", async () => {
    mocks.repos.mockRejectedValue(new Error("incomplete"));
    mocks.languages.mockRejectedValue(new Error("down"));
    mocks.githubRequest.mockResolvedValue({ ok: false });

    const m = await buildDigestMetrics("octocat", "t");

    expect(m.weeklyCommits).toBe(12);
    expect(m.topRepos).toEqual([]);
    expect(m.topLanguages).toEqual([]);
    expect(m.prsThisWeek).toBe(0);
  });

  it("uses a partial streak, never reporting longest below current", async () => {
    mocks.streak.mockResolvedValue({
      current: 30,
      longest: 12,
      lastCommitDate: "2026-11-10",
      complete: false,
      partialReason: "Request deadline",
    });

    const m = await buildDigestMetrics("octocat", "t");

    expect(m.streak).toMatchObject({ current: 30, longest: 30 });
  });

  it("refuses to report the week's commits when they're incomplete", async () => {
    mocks.contributions.mockResolvedValue({ ...week, complete: false });
    await expect(buildDigestMetrics("octocat", "t")).rejects.toThrow(
      /incomplete/
    );
  });

  it("throws when the week's commits can't be fetched", async () => {
    mocks.contributions.mockRejectedValue(new Error("search down"));
    await expect(buildDigestMetrics("octocat", "t")).rejects.toThrow();
  });
});
