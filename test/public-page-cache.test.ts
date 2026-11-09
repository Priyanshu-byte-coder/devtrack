import { describe, expect, it } from "vitest";
import {
  PUBLIC_CACHE_PARAM,
  PUBLIC_CDN_CACHE_CONTROL,
  cdnCacheControlFor,
  isPublicCacheable,
  type PublicCacheRequest,
} from "@/lib/public-page-cache";

function req(overrides: Partial<PublicCacheRequest> = {}): PublicCacheRequest {
  return {
    method: "GET",
    pathname: "/u/octocat",
    searchParams: new URLSearchParams(),
    cookieNames: [],
    localeCookie: undefined,
    headers: new Headers(),
    ...overrides,
  };
}

describe("isPublicCacheable", () => {
  it("caches signed-out views of public pages", () => {
    for (const pathname of [
      "/",
      "/leaderboard",
      "/top",
      "/top/rust",
      "/u/octocat",
      "/compare",
      "/compare/a-vs-b",
      "/guides",
      "/guides/github-leaderboard",
      "/terms",
    ])
      expect(isPublicCacheable(req({ pathname })), pathname).toBe(true);
  });

  it("never caches for a signed-in visitor", () => {
    for (const name of [
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
      "__Secure-next-auth.session-token.0",
    ])
      expect(isPublicCacheable(req({ cookieNames: ["_clck", name] }))).toBe(
        false
      );
  });

  it("caches visitors with only analytics cookies", () => {
    expect(isPublicCacheable(req({ cookieNames: ["_clck", "_clsk"] }))).toBe(
      true
    );
  });

  it("leaves other languages to render per request", () => {
    expect(isPublicCacheable(req({ localeCookie: "es" }))).toBe(false);
    expect(
      isPublicCacheable(
        req({ headers: new Headers({ "accept-language": "es-ES,es;q=0.9" }) })
      )
    ).toBe(false);
    expect(
      isPublicCacheable(
        req({ headers: new Headers({ "accept-language": "en-US,en;q=0.9" }) })
      )
    ).toBe(true);
  });

  it("skips private pages, non-GET requests, RSC fetches and auth headers", () => {
    expect(isPublicCacheable(req({ pathname: "/dashboard" }))).toBe(false);
    expect(isPublicCacheable(req({ pathname: "/claim" }))).toBe(false);
    expect(isPublicCacheable(req({ pathname: "/u/octocat/feed.xml" }))).toBe(
      false
    );
    expect(isPublicCacheable(req({ method: "POST" }))).toBe(false);
    expect(isPublicCacheable(req({ headers: new Headers({ rsc: "1" }) }))).toBe(
      false
    );
    expect(
      isPublicCacheable(
        req({ headers: new Headers({ authorization: "Bearer x" }) })
      )
    ).toBe(false);
  });

  it("doesn't rewrite a request that already carries the marker", () => {
    expect(
      isPublicCacheable(
        req({ searchParams: new URLSearchParams(`${PUBLIC_CACHE_PARAM}=1`) })
      )
    ).toBe(false);
  });
});

describe("cdnCacheControlFor", () => {
  it("keeps pages for as long as their data stays the same", () => {
    expect(cdnCacheControlFor("/terms")).toContain("s-maxage=86400");
    expect(cdnCacheControlFor("/guides/github-streak")).toContain(
      "s-maxage=86400"
    );
    expect(cdnCacheControlFor("/u/octocat")).toContain("s-maxage=21600");
    expect(cdnCacheControlFor("/top/rust")).toContain("s-maxage=21600");
    expect(cdnCacheControlFor("/leaderboard")).toBe(PUBLIC_CDN_CACHE_CONTROL);
    expect(cdnCacheControlFor("/")).toBe(PUBLIC_CDN_CACHE_CONTROL);
  });
});
