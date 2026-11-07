/**
 * CDN caching for public pages seen by signed-out visitors.
 *
 * Every page used to render on every request: the root layout reads the CSP
 * nonce, the locale cookie and Accept-Language, and most public pages read
 * the session. Profiles, the landing page and share cards used most of the
 * Hobby plan's Active CPU, largely on crawlers and first visits.
 *
 * The proxy rewrites a signed-out, default-locale request for one of these
 * pages to PUBLIC_PAGE_ROUTE, which renders the page without cookies and
 * returns it cacheable (Next marks pages themselves `private`, which Vercel
 * won't cache). The rewritten URL is the cache key, so that copy is kept
 * apart from signed-in and other-language views: Vercel's cache key ignores
 * cookies, and those requests aren't rewritten. The cached HTML and its CSP
 * header (with the nonce they share) are stored together, the accepted
 * trade-off on these pages: the nonce repeats for the cache lifetime.
 */

import { defaultLocale } from "@/i18n/config";
import { detectLocale } from "@/i18n/detection";

/** Route handler that serves the cacheable copy. */
export const PUBLIC_PAGE_ROUTE = "/api/public-page";
/** Its query parameter naming the page (path and query) to serve. */
export const PUBLIC_PAGE_SOURCE_PARAM = "src";
/** Marks the handler's own render request so the proxy doesn't send it back. */
export const PUBLIC_CACHE_PARAM = "_pub";

/**
 * The CDN keeps a page 5 minutes, then serves it stale once while it
 * refreshes. Browsers don't keep it: a visitor who signs in must see their
 * own view on the next load.
 */
export const PUBLIC_CDN_CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

const CACHEABLE_PATHS: RegExp[] = [
  /^\/$/,
  /^\/leaderboard$/,
  /^\/top(?:\/[^/]+)?$/,
  /^\/u\/[^/]+$/,
  /^\/compare(?:\/[^/]+)?$/,
  /^\/guides(?:\/[^/]+)?$/,
  /^\/(?:terms|privacy-policy|sponsor|api-docs|guidelines)$/,
];

// NextAuth splits large sessions into `<name>.0`, `<name>.1`, ...
const SESSION_COOKIE = /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/;

export interface PublicCacheRequest {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  cookieNames: string[];
  localeCookie: string | undefined;
  headers: Headers;
}

/**
 * Production only. Preview deployments sit behind Vercel's deployment
 * protection, which the handler's cookie-less render request can't pass,
 * and local and test runs have no CDN to gain from.
 */
export function publicPageCacheEnabled(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function isCacheablePath(pathname: string): boolean {
  return CACHEABLE_PATHS.some((p) => p.test(pathname));
}

export function isPublicCacheable(req: PublicCacheRequest): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!isCacheablePath(req.pathname)) return false;
  // Already marked: a direct request for the cached variant, served as-is.
  if (req.searchParams.has(PUBLIC_CACHE_PARAM)) return false;
  // Client navigations fetch RSC payloads keyed on router state; leave them.
  if (req.headers.has("rsc") || req.headers.has("next-router-prefetch"))
    return false;
  if (req.headers.has("authorization")) return false;
  if (req.cookieNames.some((name) => SESSION_COOKIE.test(name))) return false;
  const { locale } = detectLocale({
    cookieLocale: req.localeCookie,
    acceptLanguage: req.headers.get("accept-language"),
  });
  return locale === defaultLocale;
}
