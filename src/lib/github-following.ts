import "server-only";
import { GITHUB_API } from "@/lib/github";
import { githubRequest } from "@/lib/github-request";
import { cacheGet, cacheSet } from "@/lib/metrics-cache";

/** Who people follow changes slowly; a few hours stale is fine. */
const FOLLOWING_TTL_SECONDS = 6 * 60 * 60;
/** 1,000 accounts: enough for anyone following real people. */
const MAX_PAGES = 10;

const followingKey = (login: string) =>
  `github:following:v1:${login.toLowerCase()}`;

/**
 * The GitHub logins `login` follows, lowercased, for highlighting them on
 * the leaderboard. One GitHub request per 100 followed accounts, cached in
 * Redis per viewer, and only ever called for a signed-in viewer, so it adds
 * nothing to the cached pages crawlers and signed-out visitors get.
 *
 * Returns an empty set when GitHub can't answer; that is not cached, so the
 * next load tries again.
 */
export async function getFollowing(
  login: string,
  token?: string
): Promise<Set<string>> {
  // E2E and visual-regression runs: two of the fixture leaderboard's players.
  if (process.env.PLAYWRIGHT_TEST === "true")
    return new Set(["octocat", "dev-four"]);

  const key = followingKey(login);
  try {
    const cached = await cacheGet<string[]>(key);
    if (Array.isArray(cached)) return new Set(cached);
  } catch {
    // Redis down: ask GitHub.
  }

  const logins: string[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await githubRequest(
        `${GITHUB_API}/users/${encodeURIComponent(login)}/following?per_page=100&page=${page}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        }
      );
      if (!res.ok) return new Set();
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return new Set();
      for (const user of data) {
        const name = (user as { login?: unknown })?.login;
        if (typeof name === "string") logins.push(name.toLowerCase());
      }
      if (data.length < 100) break;
    }
  } catch {
    return new Set();
  }

  try {
    await cacheSet(key, logins, FOLLOWING_TTL_SECONDS);
  } catch {
    // Not cached this time; still correct.
  }
  return new Set(logins);
}
