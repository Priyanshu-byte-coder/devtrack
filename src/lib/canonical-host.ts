/** The one public address; other production hosts redirect here. */
const CANONICAL_HOST = (() => {
  try {
    return new URL(process.env.NEXTAUTH_URL ?? "https://devtrack.live").host;
  } catch {
    return "devtrack.live";
  }
})();

/**
 * Production is also reachable on Vercel's *.vercel.app aliases. A second
 * copy of the site splits search signals, can't complete GitHub sign-in
 * (the OAuth callback is tied to the canonical domain), and looks like a
 * clone to phishing filters. Preview deployments run with
 * VERCEL_ENV=preview and are left alone.
 *
 * API routes are never redirected. Vercel Cron and the hourly GitHub
 * workflow call the deployment on its *.vercel.app address and don't follow
 * redirects, so redirecting /api/cron/* silently stopped every scheduled job
 * (rank snapshots, goal sync, digests). APIs aren't indexed, so there is
 * nothing to consolidate there anyway.
 */
export function canonicalRedirectUrl(
  host: string,
  pathAndQuery: string,
  vercelEnv = process.env.VERCEL_ENV
): string | null {
  if (vercelEnv !== "production") return null;
  if (pathAndQuery === "/api" || pathAndQuery.startsWith("/api/")) return null;
  if (!host.endsWith(".vercel.app") || host === CANONICAL_HOST) return null;
  return `https://${CANONICAL_HOST}${pathAndQuery}`;
}
