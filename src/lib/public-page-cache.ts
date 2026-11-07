/**
 * CDN caching for public pages seen by signed-out visitors.
 *
 * Every page used to render on every request: the root layout reads the CSP
 * nonce, the locale cookie and Accept-Language, and most public pages read
 * the session. Profiles, the landing page and share cards used most of the
 * Hobby plan's Active CPU, largely on crawlers and first visits.
 *
 * The proxy rewrites a signed-out, default-locale request for one of these
 * pages to the same URL plus PUBLIC_CACHE_PARAM, and marks the response
 * cacheable on Vercel's CDN. The marker keeps that cached copy under its own
 * key: Vercel's cache key ignores cookies, so a signed-in visitor or one
 * reading another language must never be served it, and their requests
 * aren't rewritten. The cached HTML and its CSP header (with the nonce they
 * share) are stored together, which is the accepted trade-off on these
 * pages: the nonce repeats for the cache lifetime instead of per request.
 */

import { defaultLocale } from "@/i18n/config";
import { detectLocale } from "@/i18n/detection";

export const PUBLIC_CACHE_PARAM = "_pub";

/** Fresh for 5 minutes; after that one visitor gets the stale copy while it refreshes. */
export const PUBLIC_CDN_CACHE_CONTROL =
  "max-age=300, stale-while-revalidate=86400";

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

export function isPublicCacheable(req: PublicCacheRequest): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!CACHEABLE_PATHS.some((p) => p.test(req.pathname))) return false;
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
