import { githubRequest } from "@/lib/github-request";
/**
 * Weekly digest service — data aggregation and unsubscribe token utilities.
 *
 * Metric fetching delegates entirely to the functions already exported from
 * public-profile-data.ts so there is no duplicated GitHub API logic here.
 * Each metric is fetched independently and failures are silently absorbed so
 * that a GitHub rate-limit or network error for one data source does not
 * block the rest of the digest or cancel the send.
 *
 * Unsubscribe tokens are deterministic HMAC-SHA256 digests of the user ID,
 * which means:
 *   • No database row is required to verify a token.
 *   • Tokens are unique per user (a token for user A cannot unsubscribe user B).
 *   • Tokens do not expire — unsubscribing is an idempotent action.
 */

import { createHmac, timingSafeEqual } from "crypto";
import {
  fetchPublicStreak,
  fetchPublicContributions,
  fetchPublicTopLanguages,
  fetchPublicTopRepos,
} from "@/lib/public-profile-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DigestStreak {
  current: number;
  longest: number;
  lastCommitDate: string | null;
}

export interface DigestTopRepo {
  name: string;
  commits: number;
  url: string;
}

export interface DigestLanguage {
  name: string;
  percentage: number;
}

export interface DigestMetrics {
  streak: DigestStreak;
  weeklyCommits: number;
  weeklyActiveDays: number;
  prsThisWeek: number;
  topLanguages: DigestLanguage[];
  topRepos: DigestTopRepo[];
}

// ─── Metric aggregation ───────────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";

/**
 * Fetch the number of pull requests the user merged during the past 7 days.
 * Errors remain unavailable so the email can show its dashboard-link fallback.
 */
async function fetchWeeklyMergedPrs(
  githubLogin: string,
  token: string
): Promise<number> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  try {
    const res = await githubRequest(
      `${GITHUB_API}/search/issues?q=type:pr+author:${githubLogin}+is:merged+merged:>=${weekAgoStr}&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error('Weekly PR count unavailable');
    const data = (await res.json()) as { total_count?: number };
    return data.total_count ?? 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Aggregate the weekly digest metrics for a single user.
 *
 * Metric requests run concurrently through the shared GitHub transport.
 * Incomplete metrics fail instead of becoming zero; the email sender can use
 * its explicit unavailable-metrics fallback.
 */
export async function buildDigestMetrics(
  githubLogin: string,
  token: string
): Promise<DigestMetrics> {
  const [streakResult, contributionsResult, languagesResult, reposResult, prsResult] =
    await Promise.allSettled([
      fetchPublicStreak(githubLogin, token),
      fetchPublicContributions(githubLogin, token, 7),
      fetchPublicTopLanguages(githubLogin, token),
      fetchPublicTopRepos(githubLogin, token, 7),
      fetchWeeklyMergedPrs(githubLogin, token),
    ]);

  if ([streakResult, contributionsResult, languagesResult, reposResult, prsResult].some(result => result.status === 'rejected') ||
      (streakResult.status === 'fulfilled' && streakResult.value.complete === false) ||
      (contributionsResult.status === 'fulfilled' && contributionsResult.value.complete === false)) {
    throw new Error('Weekly digest metrics unavailable or incomplete');
  }

  const streak: DigestStreak =
    streakResult.status === "fulfilled"
      ? {
          current: streakResult.value.current,
          longest: streakResult.value.longest,
          lastCommitDate: streakResult.value.lastCommitDate,
        }
      : { current: 0, longest: 0, lastCommitDate: null };

  const contributions =
    contributionsResult.status === "fulfilled"
      ? contributionsResult.value
      : { total: 0, data: {} as Record<string, number> };

  const weeklyCommits = contributions.total;
  const weeklyActiveDays = Object.keys(contributions.data).length;

  const topLanguages: DigestLanguage[] =
    languagesResult.status === "fulfilled"
      ? languagesResult.value
          .slice(0, 5)
          .map((l) => ({ name: l.name, percentage: l.percentage }))
      : [];

  const topRepos: DigestTopRepo[] =
    reposResult.status === "fulfilled"
      ? reposResult.value.slice(0, 3)
      : [];

  const prsThisWeek =
    prsResult.status === "fulfilled" ? prsResult.value : 0;

  return {
    streak,
    weeklyCommits,
    weeklyActiveDays,
    prsThisWeek,
    topLanguages,
    topRepos,
  };
}

// ─── Unsubscribe tokens ───────────────────────────────────────────────────────

const UNSUBSCRIBE_SCOPE = "weekly-digest-unsubscribe-v1";

/**
 * Resolve the HMAC secret used to sign unsubscribe tokens.
 *
 * Prefers the dedicated DIGEST_UNSUBSCRIBE_SECRET environment variable so
 * rotating it invalidates all outstanding tokens without touching NextAuth.
 * Falls back to NEXTAUTH_SECRET for deployments that have not set the
 * dedicated variable.
 */
function getUnsubscribeSecret(): string {
  const secret =
    process.env.DIGEST_UNSUBSCRIBE_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "";
  if (!secret) {
    throw new Error(
      "DIGEST_UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET must be set to generate unsubscribe links"
    );
  }
  return secret;
}

/**
 * Generate a deterministic HMAC-SHA256 token for the given user ID.
 * The token is hex-encoded and safe to include in a URL query parameter.
 */
export function generateUnsubscribeToken(userId: string): string {
  const secret = getUnsubscribeSecret();
  return createHmac("sha256", secret)
    .update(`${UNSUBSCRIBE_SCOPE}:${userId}`)
    .digest("hex");
}

/**
 * Verify that `token` is the correct unsubscribe token for `userId`.
 * Uses a constant-time comparison to prevent timing attacks.
 */
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  try {
    const expected = generateUnsubscribeToken(userId);
    if (expected.length !== token.length) return false;
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(token, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Build the full unsubscribe URL for a given user.
 * Falls back to a relative path when NEXTAUTH_URL is not configured so the
 * link still works in self-hosted deployments that use a reverse proxy.
 */
export function buildUnsubscribeUrl(userId: string): string {
  const token = generateUnsubscribeToken(userId);
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/api/unsubscribe?uid=${encodeURIComponent(userId)}&token=${token}`;
}
