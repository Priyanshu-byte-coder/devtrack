// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/public-page/route";

const call = (src: string | null, origin = "https://devtrack.live") =>
  GET(
    new NextRequest(
      `${origin}/api/public-page` +
        (src === null ? "" : `?src=${encodeURIComponent(src)}`)
    )
  );

const okPage = () =>
  new Response("<html>ok</html>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PUBLIC_PAGE_RENDER_HOST;
});

describe("render origin", () => {
  const fetchedOrigin = () =>
    new URL(String(vi.mocked(fetch).mock.calls[0][0])).origin;

  it("renders from devtrack.live when no render host is configured", async () => {
    vi.mocked(fetch).mockResolvedValue(okPage());
    await call("/leaderboard", "https://devtrack-984.netlify.app");
    expect(fetchedOrigin()).toBe("https://devtrack.live");
  });

  it("renders from the configured host and its per-deploy addresses", async () => {
    process.env.PUBLIC_PAGE_RENDER_HOST = "devtrack-984.netlify.app";
    vi.mocked(fetch).mockResolvedValue(okPage());
    await call("/leaderboard", "https://devtrack-984.netlify.app");
    expect(fetchedOrigin()).toBe("https://devtrack-984.netlify.app");

    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue(okPage());
    await call(
      "/leaderboard",
      "https://6b09648fcc93--devtrack-984.netlify.app"
    );
    expect(fetchedOrigin()).toBe(
      "https://6b09648fcc93--devtrack-984.netlify.app"
    );
  });

  it("ignores hosts that only resemble the configured one", async () => {
    process.env.PUBLIC_PAGE_RENDER_HOST = "devtrack-984.netlify.app";
    for (const origin of [
      "https://evil.example",
      "https://x.y--devtrack-984.netlify.app",
      "https://devtrack-984.netlify.app.evil.example",
    ]) {
      vi.mocked(fetch).mockClear();
      vi.mocked(fetch).mockResolvedValue(okPage());
      await call("/leaderboard", origin);
      expect(fetchedOrigin()).toBe("https://devtrack.live");
    }
  });
});

describe("public page cache route", () => {
  it("renders the page without cookies and returns it cacheable", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>profile</html>", {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy": "script-src 'nonce-abc'",
          "set-cookie": "a=b",
          "cache-control": "private, no-store",
        },
      })
    );
    const res = await call("/u/octocat?tab=x");

    const [target, init] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(String(target));
    expect(url.origin).toBe("https://devtrack.live");
    expect(url.pathname).toBe("/u/octocat");
    expect(url.searchParams.get("tab")).toBe("x");
    expect(url.searchParams.get("_pub")).toBe("1");
    expect(new Headers(init?.headers).has("cookie")).toBe(false);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>profile</html>");
    expect(res.headers.get("cache-control")).toContain("s-maxage=21600");
    expect(res.headers.get("content-security-policy")).toBe(
      "script-src 'nonce-abc'"
    );
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("keeps a GitHub-busy page only briefly", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<div data-github-busy="">GitHub needs a breather</div>', {
        headers: { "content-type": "text/html" },
      })
    );
    const res = await call("/u/torvalds");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=120"
    );
  });

  it("keeps a guest profile for a week, a member profile for hours", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('<main data-guest-profile="">Not on DevTrack yet</main>', {
        headers: { "content-type": "text/html" },
      })
    );
    const guest = await call("/u/torvalds");
    expect(guest.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=604800, stale-while-revalidate=2592000"
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("<main>member</main>", {
        headers: { "content-type": "text/html" },
      })
    );
    const member = await call("/u/octocat");
    expect(member.headers.get("cache-control")).toContain("s-maxage=21600");
  });

  it("keeps a busy guest page briefly, not for a week", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        '<main data-guest-profile=""><div data-github-busy="">busy</div></main>',
        { headers: { "content-type": "text/html" } }
      )
    );
    const res = await call("/u/torvalds");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=120"
    );
  });

  it("keeps guides and legal pages for a day", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("<html>terms</html>", {
        headers: { "content-type": "text/html" },
      })
    );
    const res = await call("/terms");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("refuses anything but this site's public pages", async () => {
    for (const src of [
      null,
      "https://evil.example/u/x",
      "//evil.example/u/x",
      "/dashboard",
      "/api/user/settings",
    ])
      expect((await call(src)).status, String(src)).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a malformed path escape without fetching", async () => {
    expect((await call("/u/%E0%A4")).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes redirects through without the marker", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 308,
        headers: { location: "https://devtrack.live/u/octocat?_pub=1" },
      })
    );
    const res = await call("/u/OctoCat");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/u/octocat");
  });

  it("never caches a failed render", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 500 }));
    const res = await call("/u/octocat");
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
