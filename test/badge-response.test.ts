import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  BADGE_CACHE_CONTROL,
  svgBadgeResponse,
} from "@/lib/gamification/badge-response";

const request = (headers?: HeadersInit) =>
  new NextRequest("https://example.test/badge.svg", { headers });

describe("svgBadgeResponse", () => {
  it("returns SVG with secure, cacheable headers and a stable ETag", async () => {
    const response = svgBadgeResponse("<svg />", request());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<svg />");
    expect(response.headers.get("content-type")).toBe(
      "image/svg+xml; charset=utf-8"
    );
    expect(response.headers.get("cache-control")).toBe(BADGE_CACHE_CONTROL);
    expect(response.headers.get("etag")).toMatch(/^"[\w-]{27}"$/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    );
    expect(svgBadgeResponse("<svg />", request()).headers.get("etag")).toBe(
      response.headers.get("etag")
    );
  });

  it("returns 304 for a matching ETag without a body", async () => {
    const etag = svgBadgeResponse("same", request()).headers.get("etag")!;
    const response = svgBadgeResponse(
      "same",
      request({ "if-none-match": etag })
    );
    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("etag")).toBe(etag);
  });

  it("honors non-200 status, custom cache policy and extra headers", () => {
    const response = svgBadgeResponse("missing", request(), {
      status: 404,
      cacheControl: "no-store",
      extraHeaders: { "X-Badge-Reason": "not-found" },
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-badge-reason")).toBe("not-found");
  });
});
