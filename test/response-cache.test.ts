import { describe, it, expect } from "vitest";
import { privateCacheHeaders, publicCacheHeaders } from "../src/lib/response-cache";

describe("privateCacheHeaders", () => {
  it("returns correct headers with default values", () => {
    const headers = privateCacheHeaders();
    expect(headers["Cache-Control"]).toBe("private, max-age=300, stale-while-revalidate=600");
  });

  it("returns correct headers with custom maxAgeSeconds", () => {
    const headers = privateCacheHeaders(600);
    expect(headers["Cache-Control"]).toBe("private, max-age=600, stale-while-revalidate=1200");
  });

  it("returns correct headers with custom swrSeconds", () => {
    const headers = privateCacheHeaders(300, 900);
    expect(headers["Cache-Control"]).toBe("private, max-age=300, stale-while-revalidate=900");
  });

  it("returns correct headers with zero values", () => {
    const headers = privateCacheHeaders(0, 0);
    expect(headers["Cache-Control"]).toBe("private, max-age=0, stale-while-revalidate=0");
  });
});

describe("publicCacheHeaders", () => {
  it("returns correct headers with default values", () => {
    const headers = publicCacheHeaders();
    expect(headers["Cache-Control"]).toBe("public, s-maxage=300, stale-while-revalidate=600");
  });

  it("returns correct headers with custom maxAgeSeconds", () => {
    const headers = publicCacheHeaders(600);
    expect(headers["Cache-Control"]).toBe("public, s-maxage=600, stale-while-revalidate=1200");
  });

  it("returns correct headers with custom swrSeconds", () => {
    const headers = publicCacheHeaders(300, 900);
    expect(headers["Cache-Control"]).toBe("public, s-maxage=300, stale-while-revalidate=900");
  });

  it("returns correct headers with zero values", () => {
    const headers = publicCacheHeaders(0, 0);
    expect(headers["Cache-Control"]).toBe("public, s-maxage=0, stale-while-revalidate=0");
  });

  it("includes s-maxage for public caching", () => {
    const headers = publicCacheHeaders();
    expect(headers["Cache-Control"]).toContain("s-maxage=");
    expect(headers["Cache-Control"]).not.toContain("private");
  });

  it("does not include private for public caching", () => {
    const headers = publicCacheHeaders();
    expect(headers["Cache-Control"]).not.toContain("private");
  });
});
