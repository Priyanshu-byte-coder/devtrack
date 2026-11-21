/**
 * Serves a public page to signed-out visitors from Vercel's CDN.
 *
 * Next marks every dynamically rendered page `private, no-store`, and
 * Vercel won't cache a response marked private even when told to. A route
 * handler sets its own Cache-Control, so the proxy rewrites signed-out
 * page requests here (see lib/public-page-cache.ts). On a cache miss this
 * renders the page once, without cookies, and hands it back cacheable; on a
 * hit, neither this handler nor the page runs.
 */

import type { NextRequest } from "next/server";
import {
  BUSY_CDN_CACHE_CONTROL,
  GITHUB_BUSY_MARKER,
  GUEST_CDN_CACHE_CONTROL,
  GUEST_PROFILE_MARKER,
  PUBLIC_CACHE_PARAM,
  PUBLIC_PAGE_SOURCE_PARAM,
  cdnCacheControlFor,
  isCacheablePath,
} from "@/lib/public-page-cache";

export const dynamic = "force-dynamic";

/**
 * The site this renders from. A literal, not configuration or the request:
 * the handler only runs in production (lib/public-page-cache.ts), and a
 * fixed host is what keeps the fetch below from going anywhere else.
 */
const ORIGIN = "https://devtrack.live";

/** Headers worth keeping from the rendered page. Set-Cookie never is. */
const PASS_THROUGH = [
  "content-type",
  "content-security-policy",
  "content-language",
  "link",
  "x-robots-tag",
];

/**
 * The checked path and query, rebuilt piece by piece and escaped, so nothing
 * from the request can change which URL is fetched beyond those values.
 */
function encodedPath(url: URL): string {
  return url.pathname
    .split("/")
    .slice(1)
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");
}

function encodedQuery(url: URL): string {
  return [...url.searchParams]
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get(PUBLIC_PAGE_SOURCE_PARAM);
  if (!source?.startsWith("/")) return notFound();
  let target: URL;
  try {
    target = new URL(source, ORIGIN);
  } catch {
    return notFound();
  }
  // Only this site's own public pages: never a fetch the caller steers.
  if (target.origin !== ORIGIN || !isCacheablePath(target.pathname))
    return notFound();
  // The marker keeps the proxy from sending this request back here.
  target.searchParams.set(PUBLIC_CACHE_PARAM, "1");
  let pageUrl: string;
  try {
    pageUrl = `https://devtrack.live/${encodedPath(target)}?${encodedQuery(target)}`;
  } catch {
    // A malformed %-escape in the path.
    return notFound();
  }

  let page: Response;
  try {
    page = await fetch(pageUrl, {
      redirect: "manual",
      cache: "no-store",
      headers: { accept: "text/html", "accept-language": "en" },
    });
  } catch {
    return new Response("Page unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers();
  for (const name of PASS_THROUGH) {
    const value = page.headers.get(name);
    if (value) headers.set(name, value);
  }
  const location = page.headers.get("location");
  if (location) {
    const next = new URL(location, target);
    next.searchParams.delete(PUBLIC_CACHE_PARAM);
    headers.set(
      "location",
      next.origin === target.origin ? next.pathname + next.search : next.href
    );
  }
  const body = await page.text();
  // Errors aren't cached, so a failed render can't stick for everyone, and a
  // "GitHub is busy" page is kept only briefly.
  const cacheable =
    page.status === 200 ||
    page.status === 404 ||
    (page.status >= 301 && page.status <= 308);
  headers.set(
    "Cache-Control",
    !cacheable
      ? "no-store"
      : body.includes(GITHUB_BUSY_MARKER)
        ? BUSY_CDN_CACHE_CONTROL
        : body.includes(GUEST_PROFILE_MARKER)
          ? GUEST_CDN_CACHE_CONTROL
          : cdnCacheControlFor(target.pathname)
  );

  return new Response(req.method === "HEAD" ? null : body, {
    status: page.status,
    headers,
  });
}

export { GET as HEAD };
