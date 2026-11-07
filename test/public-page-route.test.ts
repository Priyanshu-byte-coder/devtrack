// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/public-page/route";

const call = (src: string | null) =>
  GET(
    new NextRequest(
      "https://devtrack.live/api/public-page" +
        (src === null ? "" : `?src=${encodeURIComponent(src)}`)
    )
  );

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());

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
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
    expect(res.headers.get("content-security-policy")).toBe(
      "script-src 'nonce-abc'"
    );
    expect(res.headers.get("set-cookie")).toBeNull();
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
