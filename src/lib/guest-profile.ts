import "server-only";
import { unstable_cache } from "next/cache";
import { githubRequest } from "@/lib/github-request";
import { resolveServerGitHubToken } from "@/lib/github-app";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { publicProfileTag } from "@/lib/public-profile-tags";
import {
  buildGuestProfile,
  type GuestProfile,
  type GuestUserNode,
  type YearTotals,
} from "@/lib/guest-profile-model";

/**
 * Guest stats are public estimates and change slowly. A week matches the page
 * cache (GUEST_CDN_CACHE_CONTROL), and the data cache outlives deploys, so a
 * deploy that empties the CDN re-renders guest pages without refetching GitHub.
 */
const GUEST_TTL_SECONDS = 7 * 24 * 60 * 60;
const REGISTRATION_TTL_SECONDS = 300;
/**
 * GraphQL points kept back for the leaderboard and signed-in users. Guest
 * pages are the one thing anonymous traffic can fan out across, so they stop
 * first when the shared budget runs low.
 */
const GUEST_RESERVE_POINTS = 1000;

/** Guest data can't be fetched right now (no token, or the budget is spent). */
export class GuestProfileUnavailableError extends Error {
  constructor(message = "Guest profiles are temporarily unavailable") {
    super(message);
    this.name = "GuestProfileUnavailableError";
  }
}

let pausedUntil = 0;

const GUEST_QUERY = `
query GuestProfile($login: String!) {
  user(login: $login) {
    login
    name
    bio
    createdAt
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 30, orderBy: { field: PUSHED_AT, direction: DESC }) {
      totalCount
      nodes { name url description stargazerCount primaryLanguage { name } }
    }
    contributionsCollection {
      contributionYears
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string
): Promise<T> {
  if (Date.now() < pausedUntil) throw new GuestProfileUnavailableError();

  const res = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(remaining) && remaining < GUEST_RESERVE_POINTS) {
    pausedUntil =
      Number.isFinite(reset) && reset > 0
        ? reset * 1000
        : Date.now() + 15 * 60_000;
  }

  if (!res.ok) throw new Error(`GitHub GraphQL failed: ${res.status}`);
  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ type?: string; message?: string }>;
  };
  // An unknown login comes back as `user: null` with a NOT_FOUND error.
  const fatal = json.errors?.filter((e) => e.type !== "NOT_FOUND");
  if (fatal?.length || !json.data) {
    throw new Error(
      `GitHub GraphQL error: ${fatal?.[0]?.message ?? "no data"}`
    );
  }
  return json.data;
}

async function fetchLifetime(
  login: string,
  years: number[],
  token: string
): Promise<YearTotals[] | null> {
  if (years.length === 0) return [];
  const fields = years
    .filter((y) => Number.isInteger(y))
    .map(
      (y) =>
        `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions }`
    )
    .join(" ");
  try {
    const data = await graphql<{ user: Record<string, YearTotals> | null }>(
      `query GuestLifetime($login: String!) { user(login: $login) { ${fields} } }`,
      { login },
      token
    );
    return data.user ? Object.values(data.user) : null;
  } catch {
    // Lifetime totals only feed XP and the rank estimate; the last year is
    // a fine fallback.
    return null;
  }
}

/**
 * Public gist count over REST. GraphQL's `gists` field answers a GitHub App
 * installation token with "Resource not accessible by integration", which
 * failed the whole profile query. Zero when GitHub can't say.
 */
async function fetchPublicGists(login: string, token: string): Promise<number> {
  try {
    const res = await githubRequest(
      `https://api.github.com/users/${encodeURIComponent(login)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { public_gists?: number };
    return data.public_gists ?? 0;
  } catch {
    return 0;
  }
}

/** A GitHub user's public profile, or null when no such user exists. */
export async function fetchGuestProfile(
  login: string
): Promise<GuestProfile | null> {
  const token = await resolveServerGitHubToken();
  // GraphQL refuses anonymous requests.
  if (!token) throw new GuestProfileUnavailableError();

  const data = await graphql<{ user: GuestUserNode | null }>(
    GUEST_QUERY,
    { login },
    token
  );
  if (!data.user) return null;

  const [lifetime, publicGists] = await Promise.all([
    fetchLifetime(
      data.user.login,
      data.user.contributionsCollection.contributionYears,
      token
    ),
    fetchPublicGists(data.user.login, token),
  ]);
  return buildGuestProfile(data.user, lifetime, publicGists);
}

const PLAYWRIGHT_GUEST = "playwright-guest";

function playwrightGuest(): GuestProfile {
  const calendar = Array.from({ length: 364 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date, count: i % 3 === 0 ? 0 : (i * 7) % 9 };
  });
  return {
    login: PLAYWRIGHT_GUEST,
    name: "Playwright Guest",
    bio: "Fixture for a GitHub user who hasn't joined DevTrack",
    githubSince: "2019-04-01T00:00:00Z",
    followers: 128,
    publicRepos: 42,
    publicGists: 3,
    calendar,
    yearContributions: calendar.reduce((s, d) => s + d.count, 0),
    activeDays: calendar.filter((d) => d.count > 0).length,
    streak: { current: 2, longest: 9 },
    lifetime: { commits: 3120, prs: 210, reviews: 95 },
    reposContributed: 17,
    topRepos: [
      {
        name: "arcade-engine",
        url: "https://github.com/playwright-guest/arcade-engine",
        description: "A tiny pixel game engine",
        stars: 912,
        language: "TypeScript",
      },
      {
        name: "dotfiles",
        url: "https://github.com/playwright-guest/dotfiles",
        description: null,
        stars: 40,
        language: "Shell",
      },
    ],
    topLanguages: [
      { name: "TypeScript", count: 6, percentage: 60 },
      { name: "Rust", count: 3, percentage: 30 },
      { name: "Shell", count: 1, percentage: 10 },
    ],
  };
}

/**
 * `pnpm dev:demo` has no GitHub connection, so any other username gets a
 * sample player built from the name: the same numbers every time, different
 * per name. Only with DEVTRACK_DEMO; end-to-end tests still see unknown
 * names as unknown.
 */
function demoGuest(login: string): GuestProfile {
  let seed = 0;
  for (const ch of login) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (min: number, max: number) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return min + (seed % (max - min + 1));
  };
  const base = playwrightGuest();
  const longest = pick(5, 120);
  return {
    ...base,
    login,
    name: null,
    bio: "Sample player: demo mode makes up stats for any username",
    followers: pick(3, 900),
    streak: { current: pick(0, longest), longest },
    lifetime: {
      commits: pick(200, 9000),
      prs: pick(10, 700),
      reviews: pick(0, 400),
    },
    reposContributed: pick(2, 60),
  };
}

/** Cached guest profile; tagged like member profiles so a claim drops it at once. */
export async function getGuestProfile(
  login: string
): Promise<GuestProfile | null> {
  const key = login.toLowerCase();
  if (process.env.PLAYWRIGHT_TEST === "true") {
    if (key === PLAYWRIGHT_GUEST) return playwrightGuest();
    // The member fixture's public GitHub data, for compare duels.
    if (key === "playwright-user") {
      return {
        ...playwrightGuest(),
        login: "playwright-user",
        name: "Playwright User",
        streak: { current: 42, longest: 61 },
        lifetime: { commits: 5400, prs: 380, reviews: 120 },
        topLanguages: [{ name: "Rust", count: 4, percentage: 100 }],
      };
    }
    if (process.env.DEVTRACK_DEMO === "true") return demoGuest(key);
    return null;
  }
  return unstable_cache(() => fetchGuestProfile(key), ["guest-profile", key], {
    revalidate: GUEST_TTL_SECONDS,
    tags: [publicProfileTag(key)],
  })();
}

export type Registration = { isPublic: boolean } | null;

/**
 * Whether this login belongs to a DevTrack account, and if so whether it is
 * public. A member who made their profile private must never get a guest
 * page instead: that would publish exactly what they chose to hide.
 */
export async function getRegistration(login: string): Promise<Registration> {
  const key = login.toLowerCase();
  if (process.env.PLAYWRIGHT_TEST === "true") {
    return key === "playwright-user" ? { isPublic: true } : null;
  }
  if (!isSupabaseAdminAvailable) throw new Error("Database unavailable");

  return unstable_cache(
    async (): Promise<Registration> => {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("is_public")
        .ilike("github_login", key)
        .limit(1);
      if (error) throw new Error("Registration lookup failed");
      const row = data?.[0];
      return row ? { isPublic: row.is_public === true } : null;
    },
    ["profile-registration", key],
    { revalidate: REGISTRATION_TTL_SECONDS, tags: [publicProfileTag(key)] }
  )();
}
