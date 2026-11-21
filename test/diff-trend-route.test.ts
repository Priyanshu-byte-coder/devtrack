import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/metrics/diff-trend/route";
import { getServerSession } from "@/lib/server-session";
import { diffTrendWeekStarts } from "@/lib/diff-trend";

vi.mock("@/lib/server-session", () => ({
  getServerSession: vi.fn(),
}));

const organizationsConfig = vi.fn<() => Record<string, boolean>>(() => ({}));
vi.mock("@/lib/supabase", () => ({
  isSupabaseAdminAvailable: true,
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { organizations_config: organizationsConfig() },
          }),
        }),
      }),
    }),
  },
}));

const NOW = new Date("2026-11-13T12:00:00Z");
const WEEKS = diffTrendWeekStarts(NOW);
const CURRENT = WEEKS.at(-1)!;
const PREVIOUS = WEEKS.at(-2)!;

type StatsReply = { status: number; body?: unknown };

let sessionCount = 0;
let commits: Array<{ repo: string; count: number }>;
let stats: Record<string, StatsReply>;
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function contributors(
  login: string,
  weeks: Array<{ w: number; a: number; d: number; c: number }>
) {
  return { author: { login }, weeks };
}

function request() {
  return new NextRequest("http://localhost/api/metrics/diff-trend");
}

describe("GET /api/metrics/diff-trend", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    organizationsConfig.mockReturnValue({});
    // A fresh user per test keeps the in-memory metrics cache from leaking.
    sessionCount++;
    vi.mocked(getServerSession).mockResolvedValue({
      accessToken: "token",
      githubLogin: "dev",
      githubId: `gh-${sessionCount}`,
    } as never);
    commits = [];
    stats = {};
    fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/search/commits")) {
        const items = commits.flatMap(({ repo, count }) =>
          Array.from({ length: count }, () => ({
            repository: { full_name: repo },
            commit: { author: { date: "2026-11-10T10:00:00Z" } },
          }))
        );
        return json({ total_count: items.length, items });
      }
      const match = url.match(
        /\/repos\/([^/]+)\/([^/]+)\/stats\/contributors$/
      );
      if (match) {
        const reply = stats[`${match[1]}/${match[2]}`] ?? { status: 404 };
        return reply.status === 204
          ? new Response(null, { status: 204 })
          : json(reply.body ?? {}, reply.status);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns 401 without a session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("sums the user's own weekly lines across their top three repositories", async () => {
    commits = [
      { repo: "dev/app", count: 5 },
      { repo: "acme/api", count: 3 },
      { repo: "dev/site", count: 2 },
      { repo: "dev/old", count: 1 },
    ];
    stats = {
      "dev/app": {
        status: 200,
        body: [
          contributors("someone-else", [{ w: CURRENT, a: 5000, d: 0, c: 9 }]),
          contributors("Dev", [
            { w: WEEKS[0] - 7 * 24 * 60 * 60, a: 777, d: 777, c: 4 },
            { w: PREVIOUS, a: 100, d: 20, c: 3 },
            { w: CURRENT, a: 40, d: 10, c: 2 },
          ]),
        ],
      },
      "acme/api": {
        status: 200,
        body: [contributors("dev", [{ w: CURRENT, a: 7, d: 3, c: 3 }])],
      },
      "dev/site": {
        status: 200,
        body: [contributors("dev", [{ w: PREVIOUS, a: 1, d: 1, c: 2 }])],
      },
      "dev/old": {
        status: 200,
        body: [contributors("dev", [{ w: CURRENT, a: 9999, d: 0, c: 1 }])],
      },
    };

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.repos).toEqual(["dev/app", "acme/api", "dev/site"]);
    expect(body.weeks).toHaveLength(12);
    expect(body.weeks.at(-2)).toEqual({
      weekStart: "2026-11-01",
      additions: 101,
      deletions: 21,
    });
    expect(body.weeks.at(-1)).toEqual({
      weekStart: "2026-11-08",
      additions: 47,
      deletions: 13,
    });
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes("/dev/old/stats"))).toBe(false);
  });

  it("leaves out organisations the user excluded", async () => {
    organizationsConfig.mockReturnValue({ acme: false });
    commits = [
      { repo: "acme/api", count: 9 },
      { repo: "dev/app", count: 1 },
    ];
    stats = {
      "dev/app": {
        status: 200,
        body: [contributors("dev", [{ w: CURRENT, a: 3, d: 1, c: 1 }])],
      },
    };

    const body = await (await GET(request())).json();

    expect(body.repos).toEqual(["dev/app"]);
  });

  it.each<[string, StatsReply]>([
    [
      // 10,000+ commits: GitHub reports the commits but zero lines.
      "has commits without line counts",
      {
        status: 200,
        body: [contributors("dev", [{ w: CURRENT, a: 0, d: 0, c: 4 }])],
      },
    ],
    [
      // GitHub only lists the top 100 contributors.
      "does not list the user",
      {
        status: 200,
        body: [contributors("other", [{ w: CURRENT, a: 1, d: 1, c: 1 }])],
      },
    ],
    ["is empty", { status: 204 }],
    [
      "is no longer accessible",
      { status: 404, body: { message: "Not Found" } },
    ],
  ])("skips a repository that %s", async (_case, reply) => {
    commits = [
      { repo: "dev/skipped", count: 5 },
      { repo: "dev/app", count: 1 },
    ];
    stats = {
      "dev/skipped": reply,
      "dev/app": {
        status: 200,
        body: [contributors("dev", [{ w: CURRENT, a: 8, d: 2, c: 1 }])],
      },
    };

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.repos).toEqual(["dev/app"]);
    expect(body.weeks.at(-1)).toMatchObject({ additions: 8, deletions: 2 });
  });

  it("reports 202 while GitHub computes stats and does not cache that answer", async () => {
    commits = [{ repo: "dev/app", count: 2 }];
    stats = { "dev/app": { status: 202, body: {} } };

    const first = await GET(request());
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ computing: true });

    stats = {
      "dev/app": {
        status: 200,
        body: [contributors("dev", [{ w: CURRENT, a: 12, d: 4, c: 2 }])],
      },
    };
    const second = await GET(request());
    const body = await second.json();

    expect(second.status).toBe(200);
    expect(body.repos).toEqual(["dev/app"]);
    expect(body.weeks.at(-1)).toMatchObject({ additions: 12, deletions: 4 });
  });

  it("asks the user to reconnect when GitHub rejects the token", async () => {
    commits = [{ repo: "dev/app", count: 2 }];
    stats = {
      "dev/app": { status: 401, body: { message: "Bad credentials" } },
    };

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "token_expired" });
  });
});
