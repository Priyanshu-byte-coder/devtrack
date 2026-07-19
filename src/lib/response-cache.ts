/**
 * Helpers for setting browser-side Cache-Control headers on API responses.
 *
 * Authenticated metric routes cannot be cached at the CDN edge (user-specific
 * data), but they CAN instruct the browser to cache them privately. This
 * eliminates redundant function invocations on every dashboard tab switch or
 * soft navigation within the same session, directly reducing Vercel Active CPU.
 *
 * Usage:
 *   return NextResponse.json(data, { headers: privateCacheHeaders(300) });
 */

/**
 * Returns Cache-Control headers for user-specific (authenticated) responses.
 * @param maxAgeSeconds   How long the browser may serve cached data (default 5 min)
 * @param swrSeconds      Extra stale-while-revalidate window (default 2× maxAge)
 */
export function privateCacheHeaders(
  maxAgeSeconds = 300,
  swrSeconds = maxAgeSeconds * 2
): HeadersInit {
  return {
    "Cache-Control": `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`,
  };
}

/**
 * Returns Cache-Control headers for fully public, unauthenticated responses.
 * These can also be cached by a CDN.
 */
export function publicCacheHeaders(
  maxAgeSeconds = 300,
  swrSeconds = maxAgeSeconds * 2
): HeadersInit {
  return {
    "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`,
  };
}
