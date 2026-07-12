import { describe, expect, it } from "vitest";
import {
  privateCacheHeaders,
  publicCacheHeaders,
} from "../src/lib/response-cache";

describe("response-cache header helpers", () => {
  it("returns private cache headers", () => {
    expect(privateCacheHeaders(300)).toEqual({
      "Cache-Control":
        "private, max-age=300, stale-while-revalidate=600",
    });
  });

  it("supports custom stale-while-revalidate", () => {
    expect(privateCacheHeaders(300, 60)).toEqual({
      "Cache-Control":
        "private, max-age=300, stale-while-revalidate=60",
    });
  });

  it("returns public cache headers", () => {
    expect(publicCacheHeaders(300)).toEqual({
      "Cache-Control":
        "public, s-maxage=300, stale-while-revalidate=600",
    });
  });

  it("supports zero max age", () => {
    expect(publicCacheHeaders(0)).toEqual({
      "Cache-Control":
        "public, s-maxage=0, stale-while-revalidate=0",
    });
  });
});
