import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

import { fetchRepoStats } from "@/lib/repo-stats";

type CallKey = "repo" | "contributors" | "gfi" | "prs";
type FailureMode = "network error" | "non-200" | "malformed JSON";

function classifyUrl(input: string | URL | Request): CallKey {
  const url = typeof input === "string" ? input : input.toString();
  if (url.includes("/contributors")) return "contributors";
  if (url.includes("good+first+issue")) return "gfi";
  if (url.includes("type:pr+is:merged")) return "prs";
  if (url.endsWith("/repos/Priyanshu-byte-coder/devtrack")) return "repo";
  throw new Error(`Unexpected fetch URL: ${url}`);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFailure(mode: FailureMode): Promise<Response> {
  if (mode === "network error") {
    return Promise.reject(new TypeError("fetch failed"));
  }
  if (mode === "non-200") {
    return Promise.resolve(new Response("Upstream error", { status: 503 }));
  }
  return Promise.resolve(
    new Response("{not-valid-json", {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

const DEFAULT_FIXTURES: Record<CallKey, unknown> = {
  repo: {
    stargazers_count: 120,
    forks_count: 34,
    open_issues_count: 9,
  },
  contributors: [
    {
      login: "alice",
      avatar_url: "https://avatars.example/alice.png",
      html_url: "https://github.com/alice",
      contributions: 30,
    },
    {
      login: "bob",
      avatar_url: "https://avatars.example/bob.png",
      html_url: "https://github.com/bob",
      contributions: 15,
    },
  ],
  gfi: { total_count: 7, items: [{ id: 1 }] },
  prs: { total_count: 88 },
};

function setupSponsors(logins: string[] = []) {
  const eq = vi.fn().mockResolvedValue({
    data: logins.map((github_login) => ({ github_login })),
    error: null,
  });
  const inFn = vi.fn().mockReturnValue({ eq });
  const select = vi.fn().mockReturnValue({ in: inFn });
  mocks.supabaseFrom.mockReturnValue({ select });
}

function stubGitHub(
  overrides: Partial<Record<CallKey, () => Promise<Response>>> = {}
) {
  mocks.fetch.mockImplementation((input: string | URL | Request) => {
    const key = classifyUrl(input);
    const override = overrides[key];
    if (override) return override();
    return Promise.resolve(jsonResponse(DEFAULT_FIXTURES[key]));
  });
}

describe("fetchRepoStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXTAUTH_SECRET", "unit-test-secret");
    vi.stubEnv("PLAYWRIGHT_TEST", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubGlobal("fetch", mocks.fetch);
    setupSponsors();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("parses normal GitHub responses and sponsor flags into RepoStats", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghs_test_token");
    setupSponsors(["bob"]);
    stubGitHub();

    const stats = await fetchRepoStats();

    expect(stats).toEqual({
      stars: 120,
      forks: 34,
      openIssues: 9,
      contributorCount: 2,
      goodFirstIssues: 7,
      contributors: [
        {
          login: "alice",
          avatar_url: "https://avatars.example/alice.png",
          html_url: "https://github.com/alice",
          isSponsor: false,
        },
        {
          login: "bob",
          avatar_url: "https://avatars.example/bob.png",
          html_url: "https://github.com/bob",
          isSponsor: true,
        },
      ],
      totalCommits: 45,
      mergedPRs: 88,
    });

    expect(mocks.fetch).toHaveBeenCalledTimes(4);
    for (const [, init] of mocks.fetch.mock.calls) {
      expect(init.headers).toMatchObject({
        Accept: "application/vnd.github.v3+json",
        Authorization: "Bearer ghs_test_token",
      });
    }
  });

  it("caps displayed contributors at 20 while keeping full contributorCount and totalCommits", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      login: `dev-${i + 1}`,
      avatar_url: `https://avatars.example/${i + 1}.png`,
      html_url: `https://github.com/dev-${i + 1}`,
      contributions: 2,
    }));
    stubGitHub({
      contributors: () => Promise.resolve(jsonResponse(many)),
      gfi: () => Promise.resolve(jsonResponse({ items: [{}, {}, {}] })),
    });

    const stats = await fetchRepoStats();

    expect(stats.contributorCount).toBe(25);
    expect(stats.totalCommits).toBe(50);
    expect(stats.contributors).toHaveLength(20);
    expect(stats.goodFirstIssues).toBe(3);
  });

  describe.each<FailureMode>(["network error", "non-200", "malformed JSON"])(
    "partial failure (%s)",
    (mode) => {
      it("falls back to 0 for repo counts while keeping contributors, good first issues, and merged PRs", async () => {
        stubGitHub({ repo: () => makeFailure(mode) });

        const stats = await fetchRepoStats();

        expect(stats.stars).toBe(0);
        expect(stats.forks).toBe(0);
        expect(stats.openIssues).toBe(0);
        expect(stats.contributorCount).toBe(2);
        expect(stats.totalCommits).toBe(45);
        expect(stats.contributors).toHaveLength(2);
        expect(stats.goodFirstIssues).toBe(7);
        expect(stats.mergedPRs).toBe(88);
      });

      it("falls back to 0 for contributor stats while keeping repo counts, good first issues, and merged PRs", async () => {
        stubGitHub({ contributors: () => makeFailure(mode) });

        const stats = await fetchRepoStats();

        expect(stats.contributorCount).toBe(0);
        expect(stats.totalCommits).toBe(0);
        expect(stats.contributors).toEqual([]);
        expect(stats.stars).toBe(120);
        expect(stats.forks).toBe(34);
        expect(stats.openIssues).toBe(9);
        expect(stats.goodFirstIssues).toBe(7);
        expect(stats.mergedPRs).toBe(88);
      });

      it("falls back to 0 for good first issues while keeping repo counts, contributors, and merged PRs", async () => {
        stubGitHub({ gfi: () => makeFailure(mode) });

        const stats = await fetchRepoStats();

        expect(stats.goodFirstIssues).toBe(0);
        expect(stats.stars).toBe(120);
        expect(stats.forks).toBe(34);
        expect(stats.openIssues).toBe(9);
        expect(stats.contributorCount).toBe(2);
        expect(stats.totalCommits).toBe(45);
        expect(stats.mergedPRs).toBe(88);
      });

      it("falls back to 0 for merged PRs while keeping repo counts, contributors, and good first issues", async () => {
        stubGitHub({ prs: () => makeFailure(mode) });

        const stats = await fetchRepoStats();

        expect(stats.mergedPRs).toBe(0);
        expect(stats.stars).toBe(120);
        expect(stats.forks).toBe(34);
        expect(stats.openIssues).toBe(9);
        expect(stats.contributorCount).toBe(2);
        expect(stats.totalCommits).toBe(45);
        expect(stats.goodFirstIssues).toBe(7);
      });
    }
  );

  it("returns all zeros without throwing when every GitHub call fails", async () => {
    mocks.fetch.mockRejectedValue(new TypeError("network down"));

    await expect(fetchRepoStats()).resolves.toEqual({
      stars: 0,
      forks: 0,
      openIssues: 0,
      contributorCount: 0,
      goodFirstIssues: 0,
      contributors: [],
      totalCommits: 0,
      mergedPRs: 0,
    });
  });

  it("falls back to zeros when JSON payloads have unexpected shapes", async () => {
    stubGitHub({
      repo: () =>
        Promise.resolve(
          jsonResponse({
            stargazers_count: "not-a-number",
            forks_count: null,
          })
        ),
      contributors: () =>
        Promise.resolve(jsonResponse({ message: "API rate limit exceeded" })),
      gfi: () => Promise.resolve(jsonResponse({ total_count: "bad" })),
      prs: () => Promise.resolve(jsonResponse({ total_count: "bad" })),
    });

    await expect(fetchRepoStats()).resolves.toEqual({
      stars: 0,
      forks: 0,
      openIssues: 0,
      contributorCount: 0,
      goodFirstIssues: 0,
      contributors: [],
      totalCommits: 0,
      mergedPRs: 0,
    });
  });

  it("keeps GitHub stats and contributors when Supabase sponsor enrichment fails", async () => {
    mocks.supabaseFrom.mockImplementation(() => {
      throw new Error("Supabase unavailable");
    });
    stubGitHub();

    const stats = await fetchRepoStats();

    expect(stats.stars).toBe(120);
    expect(stats.mergedPRs).toBe(88);
    expect(stats.contributors).toEqual([
      expect.objectContaining({ login: "alice", isSponsor: false }),
      expect.objectContaining({ login: "bob", isSponsor: false }),
    ]);
  });

  it("returns the static fixture without network calls in Playwright test mode", async () => {
    vi.stubEnv("PLAYWRIGHT_TEST", "true");

    const stats = await fetchRepoStats();

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(stats).toEqual({
      stars: 10,
      forks: 5,
      openIssues: 2,
      contributorCount: 3,
      goodFirstIssues: 1,
      contributors: [],
      totalCommits: 0,
      mergedPRs: 0,
    });
  });
});
