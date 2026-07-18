/**
 * GitHub App service layer.
 *
 * Provides installation access tokens using GitHub App credentials so
 * DevTrack can make authenticated GitHub API calls from server-side code
 * (public profile pages, background digests, achievement syncs) without
 * relying on an individual user's OAuth token.
 *
 * How it works
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * 1. Sign a short-lived JWT (RS256, 10 min TTL) using the App's private key.
 * 2. POST the JWT to /app/installations/{id}/access_tokens to obtain a
 *    standard bearer token (GitHub issues these with a 1-hour lifetime).
 * 3. Cache the bearer token in memory and refresh it ~5 minutes before it
 *    expires so callers always receive a valid token.
 * 4. Concurrent callers share a single in-flight refresh request â€” no
 *    duplicate token generation on bursts.
 *
 * Environment variables
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *   GITHUB_APP_ID              Numeric App ID (App settings â†’ About this App)
 *   GITHUB_APP_PRIVATE_KEY     PEM-encoded RSA private key.  Literal \n
 *                              escaping (as stored in Vercel / Railway env
 *                              dashboards) is normalised automatically.
 *   GITHUB_APP_INSTALLATION_ID Installation ID for the target account/org.
 *                              Find it in the App's installation URL:
 *                              /settings/installations/{id}
 *
 * Required permissions on the GitHub App
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *   contents:read    â€” read repository file trees and commit data
 *   metadata:read    â€” read public repository metadata
 *   pull_requests:read â€” read PR lists and review state
 *
 * Backwards compatibility
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * All three env vars must be set for the App path to activate.  When any is
 * missing, isGitHubAppConfigured() returns false and callers fall back to
 * process.env.GITHUB_TOKEN (a PAT) or unauthenticated requests.  Existing
 * authenticated user routes continue to use the per-user OAuth token stored
 * in the NextAuth session â€” those are unaffected by this module.
 */

import { createSign } from "node:crypto";

const GITHUB_API_BASE = "https://api.github.com";

// GitHub App JWTs may not exceed 10 minutes.
const JWT_LIFETIME_SECONDS = 600;

// Back-date iat by 60 seconds to absorb clock skew between the server and
// GitHub's API endpoints.  Without this, a fast machine can occasionally
// generate a token with an iat that GitHub considers to be in the future.
const IAT_DRIFT_SECONDS = 60;

// Start refreshing the installation token this many milliseconds before it
// expires so callers always receive a token with meaningful remaining life.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

// â”€â”€ Public types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AppConfig {
  appId: string;
  privateKey: string;
  installationId: string;
}

/** A valid installation access token together with its expiry time. */
export interface InstallationToken {
  token: string;
  /** Unix timestamp in milliseconds when this token expires (~1 hour). */
  expiresAt: number;
}

/** Diagnostics returned by getInstallationRateLimitInfo(). */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date | null;
  resource: string;
}

// â”€â”€ In-process token cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let tokenCache: InstallationToken | null = null;

/**
 * Single in-flight refresh promise.  Any caller that arrives while a refresh
 * is already running awaits the same promise rather than issuing a duplicate
 * token-generation request.
 */
let refreshPromise: Promise<InstallationToken> | null = null;

// â”€â”€ Config helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns true when all three GitHub App environment variables are present
 * and non-empty.  Use this to guard App-based code paths so deployments that
 * have not configured a GitHub App continue to work without modification.
 */
export function isGitHubAppConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY &&
      process.env.GITHUB_APP_INSTALLATION_ID,
  );
}

/**
 * Read and validate the GitHub App environment variables.
 * Normalises literal \n sequences in the private key so the PEM can be stored
 * as a single-line string in environment dashboards.
 *
 * @throws {Error} When any required variable is missing.
 */
export function readAppConfig(): AppConfig {
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (!appId) throw new Error("GITHUB_APP_ID is not configured");
  if (!rawKey) throw new Error("GITHUB_APP_PRIVATE_KEY is not configured");
  if (!installationId)
    throw new Error("GITHUB_APP_INSTALLATION_ID is not configured");

  // Normalise keys stored with literal backslash-n (common in Vercel,
  // Railway, and similar env dashboards that don't support multiline values).
  const privateKey = rawKey.replace(/\\n/g, "\n");

  return { appId, privateKey, installationId };
}

// â”€â”€ JWT generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toBase64Url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

/**
 * Generate a signed RS256 JWT for GitHub App authentication.
 *
 * The JWT is intentionally short-lived (â‰¤10 min) and is used solely to
 * exchange for an installation access token â€” it is never exposed to users.
 *
 * @param appId      GitHub App numeric ID (from the App settings page).
 * @param privateKey PEM-encoded RSA private key with proper header/footer.
 */
export function buildAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const iat = now - IAT_DRIFT_SECONDS;
  const exp = now + JWT_LIFETIME_SECONDS;

  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({ iss: appId, iat, exp }));
  const signingInput = `${header}.${payload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

// â”€â”€ Installation token fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Request a fresh installation access token from GitHub.
 *
 * Callers should prefer getInstallationToken() which wraps this function with
 * caching and deduplication logic.
 *
 * @throws {Error} On network failure, non-2xx response, or malformed payload.
 */
export async function fetchInstallationToken(
  config: AppConfig,
): Promise<InstallationToken> {
  const jwt = buildAppJwt(config.appId, config.privateKey);

  const res = await fetch(
    `${GITHUB_API_BASE}/app/installations/${config.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(
      `GitHub App token request failed: HTTP ${res.status} â€” ${body}`,
    );
  }

  const data = (await res.json()) as {
    token?: string;
    expires_at?: string;
  };

  if (!data.token || !data.expires_at) {
    throw new Error(
      "GitHub App token response is missing required fields (token, expires_at)",
    );
  }

  return {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
  };
}

// â”€â”€ Token lifecycle management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns true when the cached token has more than TOKEN_REFRESH_BUFFER_MS
 * of remaining lifetime so it is safe to use without an immediate refresh.
 */
function isCacheValid(): boolean {
  if (!tokenCache) return false;
  const refreshAt = tokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS;
  return Date.now() < refreshAt;
}

/**
 * Return a valid installation access token, refreshing it as needed.
 *
 * Tokens are cached for their full lifetime (~1 hour) and proactively
 * refreshed 5 minutes before expiry.  Concurrent callers share one in-flight
 * refresh request â€” the GitHub API is never called more than once per window.
 *
 * @throws {Error} When env vars are missing or the GitHub API request fails.
 *   On failure the cache is cleared so the next call retries rather than
 *   serving a known-bad entry.
 */
export async function getInstallationToken(): Promise<string> {
  // Fast path: cached token is still fresh.
  if (isCacheValid()) {
    return tokenCache!.token;
  }

  // If a refresh is already in flight, piggyback on it rather than issuing a
  // second parallel request.
  if (refreshPromise) {
    const result = await refreshPromise;
    return result.token;
  }

  // Kick off a new refresh.  The finally block clears refreshPromise so the
  // next caller after this one completes starts a clean refresh.
  const pending = (async (): Promise<InstallationToken> => {
    try {
      const config = readAppConfig();
      const fresh = await fetchInstallationToken(config);
      tokenCache = fresh;
      return fresh;
    } catch (err) {
      // Clear a potentially stale cache entry so the next call retries.
      tokenCache = null;
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  refreshPromise = pending;
  const result = await pending;
  return result.token;
}

/**
 * Evict the in-process token cache.
 *
 * Useful in error-recovery paths where a token has been rejected by GitHub
 * (e.g. after an installation is suspended) and in tests that need a clean
 * cache state between runs.
 */
export function clearTokenCache(): void {
  tokenCache = null;
  refreshPromise = null;
}

// â”€â”€ Server-side token resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Resolve the best available server-side GitHub token for operations that run
 * outside of a user request (background jobs, public-profile API, digests).
 *
 * Priority:
 *  1. GitHub App installation token â€” 5 000 req/hr per installation, shared
 *     across all server-side calls, automatically refreshed before expiry.
 *  2. GITHUB_TOKEN environment variable â€” a classic PAT for simpler setups.
 *  3. undefined â€” GitHub allows 60 unauthenticated req/hr per origin IP.
 *
 * This function never throws; App token failures are logged and the PAT
 * fallback is used so background jobs remain operational.
 */
export async function resolveServerGitHubToken(): Promise<string | undefined> {
  if (isGitHubAppConfigured()) {
    try {
      return await getInstallationToken();
    } catch (err) {
      console.warn(
        "[github-app] Installation token unavailable, falling back to GITHUB_TOKEN:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return process.env.GITHUB_TOKEN || undefined;
}

// â”€â”€ Rate limit diagnostics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Return the current rate limit status for the installation token, or null
 * when the GitHub App is not configured or the request fails.
 *
 * Use this to surface rate-limit headroom in diagnostics / health endpoints.
 */
export async function getInstallationRateLimitInfo(): Promise<RateLimitInfo | null> {
  if (!isGitHubAppConfigured()) return null;

  try {
    const token = await getInstallationToken();

    const res = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      resources: {
        core: { remaining: number; limit: number; reset: number };
      };
    };

    const core = data.resources?.core;
    if (!core) return null;

    return {
      remaining: core.remaining,
      limit: core.limit,
      resetAt: new Date(core.reset * 1000),
      resource: "core",
    };
  } catch {
    return null;
  }
}
