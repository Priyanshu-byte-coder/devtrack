// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { webcrypto } from "node:crypto";
vi.unmock("@/lib/github-request");
const cache = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/metrics-cache", () => ({
  cacheGet: vi.fn(async (key: string) => cache.get(key) ?? null),
  cacheSet: vi.fn(async (key: string, value: unknown) => {
    cache.set(key, value);
  }),
}));
import { githubRequest, resetGitHubRequestState } from "@/lib/github-request";
import {
  GitHubRateLimitError,
  githubRateLimitResponse,
} from "@/lib/github-rate-limit";
const token = (value = "test-a") => ({ Authorization: `Bearer ${value}` });
const json = (value: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(value), { headers });
beforeEach(() => {
  cache.clear();
  resetGitHubRequestState();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
describe("GitHub transport coordination", () => {
  it("coalesces concurrent reads and returns independently readable responses", async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return json({ items: [1] });
    });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        githubRequest("https://api.github.com/user", { headers: token() })
      )
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await Promise.all(responses.map((r) => r.json()))).toEqual(
      Array(8).fill({ items: [1] })
    );
    await githubRequest("https://api.github.com/user", { headers: token() });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect([...cache.keys()].join(" ")).not.toContain("test-a");
  });
  it("isolates credential and representation caches", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ login: "a" }))
      .mockResolvedValueOnce(json({ login: "b" }))
      .mockResolvedValueOnce(json({ login: "new-version" }));
    expect(
      await (
        await githubRequest("https://api.github.com/user", {
          headers: token("a"),
        })
      ).json()
    ).toEqual({ login: "a" });
    expect(
      await (
        await githubRequest("https://api.github.com/user", {
          headers: token("b"),
        })
      ).json()
    ).toEqual({ login: "b" });
    await githubRequest("https://api.github.com/user", {
      headers: { ...token("b"), "X-GitHub-Api-Version": "2026-03-10" },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("bounds concurrency per credential and resource", async () => {
    const active = { core: 0, search: 0 };
    const maximum = { core: 0, search: 0 };
    vi.mocked(fetch).mockImplementation(async (input) => {
      const kind = String(input).includes("/search/") ? "search" : "core";
      active[kind]++;
      maximum[kind] = Math.max(maximum[kind], active[kind]);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active[kind]--;
      return json({ items: [], total_count: 0 });
    });
    await Promise.all([
      ...Array.from({ length: 8 }, (_, i) =>
        githubRequest(`https://api.github.com/repos/o/r${i}`, {
          headers: token(),
        })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        githubRequest(`https://api.github.com/search/commits?q=x&page=${i}`, {
          headers: token(),
        })
      ),
    ]);
    expect(maximum).toEqual({ core: 4, search: 1 });
  });
  it("serves search from cache for minutes but revalidates when asked", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      json({ items: [] }, { etag: '"s"' })
    );
    const url = "https://api.github.com/search/commits?q=author:a";
    await githubRequest(url, { headers: token() });
    for (const value of cache.values())
      if (value && typeof value === "object" && "savedAt" in value)
        (value as { savedAt: number }).savedAt -= 120_000;
    await githubRequest(url, { headers: token() });
    expect(fetch).toHaveBeenCalledTimes(1);
    await githubRequest(url, { headers: token(), cache: "no-cache" });
    expect(fetch).toHaveBeenCalledTimes(2);
    // Sibling widgets refreshing in the same burst share that revalidation.
    await githubRequest(url, { headers: token(), cache: "no-cache" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("conditionally refreshes stale responses with ETag", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ login: "a" }, { etag: '"abc"' }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    await githubRequest("https://api.github.com/user", { headers: token() });
    for (const value of cache.values())
      if (value && typeof value === "object" && "savedAt" in value)
        (value as { savedAt: number }).savedAt -= 31_000;
    const response = await githubRequest("https://api.github.com/user", {
      headers: token(),
    });
    expect(await response.json()).toEqual({ login: "a" });
    expect(
      new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get(
        "if-none-match"
      )
    ).toBe('"abc"');
  });
  it("honors primary resets without blocking the other resource or credential", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response('{"message":"API rate limit exceeded"}', {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(Math.ceil(Date.now() / 1000) + 90),
          },
        })
      )
      .mockImplementation(async () => json({}));
    await expect(
      githubRequest("https://api.github.com/search/commits?q=x", {
        headers: token(),
      })
    ).rejects.toBeInstanceOf(GitHubRateLimitError);
    await expect(
      githubRequest("https://api.github.com/search/issues?q=y", {
        headers: token(),
      })
    ).rejects.toBeInstanceOf(GitHubRateLimitError);
    expect(fetch).toHaveBeenCalledTimes(1);
    await githubRequest("https://api.github.com/user", { headers: token() });
    await githubRequest("https://api.github.com/search/issues?q=y", {
      headers: token("other"),
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("treats a 429 with remaining=0 as primary and keeps other resources open", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response('{"message":"API rate limit exceeded"}', {
          status: 429,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(Math.ceil(Date.now() / 1000) + 40),
          },
        })
      )
      .mockImplementation(async () => json({}));
    await expect(
      githubRequest("https://api.github.com/search/commits?q=x", {
        headers: token(),
      })
    ).rejects.toBeInstanceOf(GitHubRateLimitError);
    await githubRequest("https://api.github.com/user", { headers: token() });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("applies secondary cooldowns to all resources and propagates Retry-After", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"message":"secondary rate limit"}', {
        status: 403,
        headers: { "retry-after": "75" },
      })
    );
    let error: unknown;
    try {
      await githubRequest("https://api.github.com/search/commits?q=x", {
        headers: token(),
      });
    } catch (e) {
      error = e;
    }
    expect(githubRateLimitResponse(error)?.headers.get("retry-after")).toBe(
      "75"
    );
    await expect(
      githubRequest("https://api.github.com/user", { headers: token() })
    ).rejects.toBeInstanceOf(GitHubRateLimitError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not classify permission 403 as quota exhaustion", async () => {
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response('{"message":"Resource not accessible"}', { status: 403 })
    );
    expect(
      (await githubRequest("https://api.github.com/user", { headers: token() }))
        .status
    ).toBe(403);
    await githubRequest("https://api.github.com/user/repos", {
      headers: token(),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("recognizes GraphQL rate errors and never caches incomplete GraphQL responses", async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ errors: [{ type: "RATE_LIMITED", message: "Rate limit" }] })
    );
    const init = {
      method: "POST",
      headers: token(),
      body: JSON.stringify({ query: "query { viewer { login } }" }),
    };
    await expect(
      githubRequest("https://api.github.com/graphql", init)
    ).rejects.toBeInstanceOf(GitHubRateLimitError);
    expect(
      [...cache.keys()].some((key) => key.startsWith("github:response:"))
    ).toBe(false);
  });
  it("lets one consumer cancel without cancelling another shared consumer", async () => {
    const abort = new AbortController();
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const first = githubRequest("https://api.github.com/user", {
      headers: token(),
      signal: abort.signal,
    });
    const caught = first.catch((error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const second = githubRequest("https://api.github.com/user", {
      headers: token(),
    });
    abort.abort();
    finish(json({ login: "a" }));
    expect(await caught).toBeInstanceOf(DOMException);
    expect(await (await second).json()).toEqual({ login: "a" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("passes other providers through without GitHub authorization or caching changes", async () => {
    vi.mocked(fetch).mockImplementation(async () => json({}));
    const init = { headers: { "x-test": "yes" } };
    await githubRequest("https://gitlab.com/api/v4/events", init);
    expect(fetch).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/events",
      init
    );
  });
});

it("follows renamed repositories only within the GitHub API authority", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        headers: { location: "https://api.github.com/repos/new/name" },
      })
    )
    .mockResolvedValueOnce(json({ name: "name" }));
  expect(
    await (
      await githubRequest("https://api.github.com/repos/old/name", {
        headers: token(),
      })
    ).json()
  ).toEqual({ name: "name" });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(
    new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get("authorization")
  ).toBe("Bearer test-a");
});
it("rejects redirects to another host without forwarding credentials", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: "https://example.com/steal" },
    })
  );
  await expect(
    githubRequest("https://api.github.com/repos/old/name", { headers: token() })
  ).rejects.toThrow("Unsafe GitHub redirect");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps a full slot held after a queued caller times out", async () => {
  const originalTimer = globalThis.setTimeout;
  const timerSpy = vi
    .spyOn(globalThis, "setTimeout")
    .mockImplementation(((
      callback: (...args: unknown[]) => void,
      delay: number,
      ...args: unknown[]
    ) =>
      originalTimer(
        callback,
        delay === 12000 ? 5 : delay,
        ...args
      )) as typeof setTimeout);
  let complete!: (value: Response) => void;
  vi.mocked(fetch)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    )
    .mockImplementation(async () => json({}));
  const active = githubRequest("https://api.github.com/search/commits?q=a", {
    headers: token(),
  });
  for (let i = 0; i < 100 && !complete; i++)
    await new Promise((resolve) => originalTimer(resolve, 1));
  expect(complete).toBeDefined();
  const queued = githubRequest("https://api.github.com/search/commits?q=b", {
    headers: token(),
  }).catch((error) => error);
  expect(await queued).toBeInstanceOf(Error);
  await expect(
    githubRequest("https://api.github.com/search/commits?q=c", {
      headers: token(),
    })
  ).rejects.toThrow("queue timed out");
  expect(fetch).toHaveBeenCalledTimes(1);
  complete(json({ login: "alice" }));
  await active;
  timerSpy.mockRestore();
});

it("honors GraphQL primary reset without blocking remaining REST quota", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      json(
        { errors: [{ type: "RATE_LIMITED" }] },
        {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.ceil(Date.now() / 1000) + 600),
        }
      )
    )
    .mockImplementation(async () => json({ login: "available" }));
  let error: unknown;
  try {
    await githubRequest("https://api.github.com/graphql", {
      method: "POST",
      headers: token(),
      body: JSON.stringify({ query: "{ viewer { login } }" }),
    });
  } catch (caught) {
    error = caught;
  }
  expect(
    Number(githubRateLimitResponse(error)?.headers.get("retry-after"))
  ).toBeGreaterThanOrEqual(599);
  await expect(
    githubRequest("https://api.github.com/graphql", {
      method: "POST",
      headers: token(),
      body: JSON.stringify({ query: "{ viewer { id } }" }),
    })
  ).rejects.toBeInstanceOf(GitHubRateLimitError);
  expect(
    (await githubRequest("https://api.github.com/user", { headers: token() }))
      .ok
  ).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});
