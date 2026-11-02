import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * README badges are fetched through GitHub's image proxy, which keeps an
 * image for a year unless told otherwise, so every badge carries an explicit
 * short Cache-Control plus an ETag.
 */
export const BADGE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400";

export function svgBadgeResponse(
  svg: string,
  req: NextRequest,
  {
    status = 200,
    cacheControl = BADGE_CACHE_CONTROL,
    extraHeaders = {},
  }: {
    status?: number;
    cacheControl?: string;
    extraHeaders?: Record<string, string>;
  } = {}
): NextResponse {
  const etag = `"${createHash("sha1").update(svg).digest("base64url").slice(0, 27)}"`;
  const headers = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    // An SVG opened directly must not run anything.
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    ...extraHeaders,
  };
  if (status === 200 && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(svg, { status, headers });
}
