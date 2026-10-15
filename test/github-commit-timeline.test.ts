import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github-request", () => ({
  githubRequest: (input: string | URL | Request, init?: RequestInit) =>
    fetch(input, init),
}));

import {
  collectAuthorCommits,
  resetCommitTimelines,
  scopeCommits,
} from "@/lib/github-search";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();
const dateOnly = (n: number) => daysAgo(n).slice(0, 10);

function respond(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200 });
}

function history(nodes: string[], next: string | null = null) {
  return {
    defaultBranchRef: {
      target: {
        history: {
          pageInfo: { hasNextPage: next !== null, endCursor: next },
          nodes: nodes.map((date, i) => ({
            oid: `${date}-${i}`,
            messageHeadline: "msg",
            url: "u",
            authoredDate: date,
          })),
        },
      },
    },
  };
}

describe("collectAuthorCommits GraphQL timeline", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    resetCommitTimelines();
  });

  function serve(
    repos: string[],
    pages: Record<string, Array<ReturnType<typeof history> | null>>
  ) {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const { query, variables } = JSON.parse(String(init.body));
      if (query.includes("query CommitRepos"))
        return respond({
          user: {
            id: "U_1",
            year: {
              commitContributionsByRepository: repos.map((nameWithOwner) => ({
                repository: { nameWithOwner },
              })),
            },
            recent: {
              commitContributionsByRepository: [
                { repository: { nameWithOwner: repos[0] } },
              ],
            },
          },
        });
      const data: Record<string, unknown> = {};
      for (let i = 0; variables[`o${i}`] !== undefined; i++) {
        const name = `${variables[`o${i}`]}/${variables[`n${i}`]}`;
        const page = variables[`a${i}`] ? 1 : 0;
        const entry = pages[name][page];
        data[`r${i}`] = entry && {
          nameWithOwner: name,
          url: `https://github.com/${name}`,
          description: null,
          ...entry,
        };
      }
      return respond(data);
    });
  }

  it("follows history cursors, skips missing repos and filters to the window", async () => {
    serve(["a/one", "b/two", "c/gone"], {
      "a/one": [
        history([daysAgo(1), daysAgo(40)], "cursor"),
        history([daysAgo(100)]),
      ],
      "b/two": [history([daysAgo(5)])],
      "c/gone": [null],
    });

    const result = await collectAuthorCommits("Alice", dateOnly(60), "tok");

    expect(result.complete).toBe(true);
    expect(result.items.map((item) => item.commit.author.date)).toEqual(
      [daysAgo(1), daysAgo(5), daysAgo(40)].map((d) =>
        expect.stringContaining(d.slice(0, 10))
      )
    );
    // 1 repo discovery + first history batch + one follow-up page for a/one
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const discovery = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(discovery.variables.login).toBe("alice");
  });

  it("serves every window from one timeline", async () => {
    serve(["a/one"], { "a/one": [history([daysAgo(1), daysAgo(200)])] });

    const year = await collectAuthorCommits("alice", dateOnly(365), "tok");
    const month = await collectAuthorCommits("alice", dateOnly(30), "tok");

    expect(year.items).toHaveLength(2);
    expect(month.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not use search quota when a token is available", async () => {
    serve(["a/one"], { "a/one": [history([daysAgo(1)])] });
    await collectAuthorCommits("alice", dateOnly(90), "tok");
    for (const [url] of fetchMock.mock.calls)
      expect(String(url)).toBe("https://api.github.com/graphql");
  });
});

describe("scopeCommits", () => {
  const at = (date: string, full_name: string) => ({
    commit: { author: { date } },
    repository: { full_name },
  });
  const items = [
    at("2026-03-02T10:00:00Z", "Acme/api"),
    at("2026-03-01T10:00:00Z", "acme/web"),
    at("2026-02-01T10:00:00Z", "alice/dotfiles"),
  ];

  it("matches repo:, org: and -org: case-insensitively", () => {
    expect(scopeCommits(items, { repo: "acme/API" })).toHaveLength(1);
    expect(scopeCommits(items, { org: "ACME" })).toHaveLength(2);
    expect(scopeCommits(items, { excludedOrgs: ["acme"] })).toEqual([items[2]]);
  });

  it("includes the whole `until` day", () => {
    expect(scopeCommits(items, { until: "2026-03-01" })).toEqual(
      items.slice(1)
    );
  });
});
