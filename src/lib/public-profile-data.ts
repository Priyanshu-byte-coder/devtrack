import { calculateStreakFromDates } from "@/lib/streak";
import type { GitHubAchievement } from "@/lib/github-achievements";
import { syncGitHubAchievementsForUser } from "@/lib/github-achievements";
import { fetchPinnedRepoDetails, type PinnedRepoDetails } from "@/lib/pinned-repos";
import { getUserByUsername, supabaseAdmin } from "@/lib/supabase";
import { resolveServerGitHubToken } from "@/lib/github-app";

const GITHUB_API = "https://api.github.com";

export interface TopRepo {
  name: string;
  commits: number;
  url: string;
}

export interface PublicLanguage {
  name: string;
  count: number;
  percentage: number;
}

export interface ContributionData {
  days: number;
  total: number;
  data: Record<string, number>;
}

export interface StreakData {
  current: number;
  longest: number;
  lastCommitDate: string | null;
  totalActiveDays: number;
}

export interface WeeklyGoalProgress {
  completed: number;
  total: number;
  percentage: number;
}

export type PublicWidgetKey = "streak" | "contributions" | "languages" | "prs";

export interface PublicProfileData {
  username: string;
  bio: string | null;
  isSponsor: boolean;
  publicGists: number;
  memberSince: string | null;
  repos: TopRepo[];
  contributions: ContributionData;
  streak: StreakData;
  topLanguages: PublicLanguage[];
  pullRequests: number;
  achievements: GitHubAchievement[];
  achievementsError?: string | null;
  spotlightRepos?: PinnedRepoDetails[];
  contributionMilestones?: { label: string; achievedAt: string | null }[];
  weeklyGoalProgress: WeeklyGoalProgress | null;
  publicWidgets: PublicWidgetKey[];
}

async function ghFetch(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers, cache: "no-store" });
}

/**
 * Fetches the total number of public gists for a given GitHub user.
 * @param username - The GitHub username.
 * @param token - Optional GitHub personal access token.
 * @returns The number of public gists.
 */
export async function fetchPublicGists(
  username: string,
  token?: string
): Promise<number> {
  const res = await ghFetch(`${GITHUB_API}/users/${username}`, token);

  if (!res.ok) return 0;

  const data = (await res.json()) as { public_gists?: number };
  return data.public_gists ?? 0;
}

/**
 * Fetches the user's top public repositories based on recent commit activity.
 * @param username - The GitHub username.
 * @param token - Optional GitHub personal access token.
 * @param days - The number of days to look back for activity (default: 30).
 * @returns An array of top repositories.
 */
export async function fetchPublicTopRepos(
  username: string,
  token?: string,
  days = 30
): Promise<TopRepo[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const res = await ghFetch(
    `${GITHUB_API}/search/commits?q=author:${username}+author-date:>=${sinceStr}&per_page=100&sort=author-date&order=desc`,
    token
  );

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items: Array<{ repository: { full_name: string; html_url: string } }>;
  };

  const repoMap: Record<string, { commits: number; url: string }> = {};
  for (const item of data.items) {
    const name = item.repository.full_name;
    if (!repoMap[name]) repoMap[name] = { commits: 0, url: item.repository.html_url };
    repoMap[name].commits++;
  }

  return Object.entries(repoMap)
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 6);
}

/**
 * Fetches the user's public contribution data over a specified number of days.
 * @param username - The GitHub username.
 * @param token - Optional GitHub personal access token.
 * @param days - The number of days to look back for activity (default: 365).
 * @returns Contribution data including daily counts and total.
 */
export async function fetchPublicContributions(
  username: string,
  token?: string,
  days = 365
): Promise<ContributionData> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const q = `author:${username}+author-date:>=${sinceStr}`;
  let allItems: Array<{ commit: { author: { date: string } } }> = [];
  let totalCount = 0;
  let page = 1;

  while (page <= 10) {
    const url = new URL(`${GITHUB_API}/search/commits`);
    url.searchParams.set("q", q);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "author-date");
    url.searchParams.set("order", "desc");

    const res = await ghFetch(url.toString(), token);

    if (!res.ok) {
      if (allItems.length === 0) {
        return { days, total: 0, data: {} };
      }
      break;
    }

    const data = (await res.json()) as {
      total_count: number;
      items: Array<{ commit: { author: { date: string } } }>;
    };

    if (page === 1) {
      totalCount = data.total_count;
    }

    allItems = allItems.concat(data.items);

    if (data.items.length < 100) {
      break;
    }

    if (allItems.length >= 1000 || allItems.length >= totalCount) {
      break;
    }

    page += 1;
  }

  const commitsByDay: Record<string, number> = {};
  for (const item of allItems) {
    const date = item.commit.author.date.slice(0, 10);
    commitsByDay[date] = (commitsByDay[date] ?? 0) + 1;
  }

  return { days, total: totalCount, data: commitsByDay };
}

/**
 * Fetches the user's current and longest contribution streaks over the last year.
 * @param username - The GitHub username.
 * @param token - Optional GitHub personal access token.
 * @returns Streak data including current and longest lengths.
 */
export async function fetchPublicStreak(
  username: string,
  token?: string,
  timezone?: string
): Promise<StreakData> {
  const since = new Date();
  since.setDate(since.getDate() - 365);
  const sinceStr = since.toISOString().slice(0, 10);

  const res = await ghFetch(
    `${GITHUB_API}/search/commits?q=author:${username}+author-date:>=${sinceStr}&per_page=100&sort=author-date&order=desc`,
    token
  );

  if (!res.ok) return { current: 0, longest: 0, lastCommitDate: null, totalActiveDays: 0 };

  const data = (await res.json()) as {
    items: Array<{ commit: { author: { date: string } } }>;
  };

  const tz = timezone || "UTC";
  const activeDates = new Set<string>();
  for (const item of data.items) {
    try {
      const d = new Date(item.commit.author.date);
      const tzDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      activeDates.add(tzDate);
    } catch (e) {
      activeDates.add(item.commit.author.date.slice(0, 10));
    }
  }

  const result = calculateStreakFromDates(activeDates, new Set(), tz);
  return {
    current: result.current,
    longest: result.longest,
    lastCommitDate: result.lastCommitDate,
    totalActiveDays: result.totalActiveDays,
  };
}

/**
 * Calculates the top language by sampling the user's 30 most recently updated
 * repositories and counting which primary language appears most frequently.
 */
export async function fetchTopLanguage(
  username: string,
  token?: string
): Promise<string | null> {
  const res = await ghFetch(
    `${GITHUB_API}/users/${username}/repos?sort=updated&per_page=30`,
    token
  );
  
  if (!res.ok) return null;
  
  const repos = (await res.json()) as Array<{ language: string | null }>;
  
  const counts: Record<string, number> = {};
  for (const r of repos) {
    if (r.language) {
      counts[r.language] = (counts[r.language] || 0) + 1;
    }
  }
  
  let topLang: string | null = null;
  let maxCount = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      topLang = lang;
    }
  }
  
  return topLang;
}

/**
 * Fetches the top programming languages used in the user's recently updated public repositories.
 * @param username - The GitHub username.
 * @param token - Optional GitHub personal access token.
 * @returns An array of the top languages with their usage percentages.
 */
export async function fetchPublicTopLanguages(
  username: string,
  token?: string
): Promise<PublicLanguage[]> {
  const res = await ghFetch(
    `${GITHUB_API}/users/${username}/repos?sort=updated&per_page=30`,
    token
  );

  if (!res.ok) return [];

  const repos = (await res.json()) as Array<{ language: string | null }>;
  const counts: Record<string, number> = {};

  for (const repo of repos) {
    if (repo.language) {
      counts[repo.language] = (counts[repo.language] ?? 0) + 1;
    }
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];

  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Fetches the total number of pull requests opened by the user.
 * @param username - The GitHub username.
 * @param token - Optional GitHub personal access token.
 * @returns The number of pull requests.
 */
export async function fetchPublicPullRequests(
  username: string,
  token?: string
): Promise<number> {
  const res = await ghFetch(
    `${GITHUB_API}/search/issues?q=type:pr+author:${username}&per_page=1`,
    token
  );

  if (!res.ok) return 0;

  const data = (await res.json()) as { total_count?: number };
  return data.total_count ?? 0;
}

async function fetchPublicWeeklyGoalProgress(
  userId: string,
  showOnProfile: boolean
): Promise<WeeklyGoalProgress | null> {
  if (!showOnProfile) return null;

  try {
    const { data: goals, error } = await supabaseAdmin
      .from("goals")
      .select("current, target")
      .eq("user_id", userId)
      .eq("recurrence", "weekly");

    if (error || !goals) return null;

    const total = goals.length;
    if (total === 0) return null;

    const completed = goals.filter((g) => g.current >= g.target).length;
    const percentage = Math.round((completed / total) * 100);

    return { completed, total, percentage };
  } catch {
    return null;
  }
}

/**
 * Aggregates all public profile data for a given user, including repos, contributions, and streaks.
 * @param username - The GitHub username.
 * @param options - Additional options like whether to include achievements.
 * @returns The aggregated public profile data, or null if the user isn't found.
 */
export async function fetchPublicProfile(
  username: string,
  options: { includeAchievements?: boolean } = {}
): Promise<PublicProfileData | null> {
  if (process.env.PLAYWRIGHT_TEST === "true" && username === "playwright-user") {
    return {
      username: "playwright-user",
      bio: "Test user for visual regression",
      isSponsor: false,
      publicGists: 5,
      memberSince: "2026-06-01T00:00:00.000Z",
      repos: [],
      contributions: { days: 30, total: 10, data: {} },
      streak: { current: 5, longest: 10, lastCommitDate: "2026-06-01", totalActiveDays: 50 },
      topLanguages: [{ name: "TypeScript", count: 10, percentage: 100 }],
      pullRequests: 2,
      achievements: [],
      achievementsError: null,
      spotlightRepos: [],
      contributionMilestones: [],
      weeklyGoalProgress: null,
      publicWidgets: ["streak", "contributions"],
    };
  }

  const user = await getUserByUsername(username);
  if (!user) return null;

  // Prefer a GitHub App installation token (5 000 req/hr per installation)
  // over a plain PAT, then fall back to unauthenticated (60 req/hr per IP).
  const githubToken = await resolveServerGitHubToken();
  const [
    publicGists,
    repos,
    contributions,
    streak,
    topLanguages,
    pullRequests,
    achievementsCache,
    spotlight,
    weeklyGoalProgress,
  ] = await Promise.all([
    fetchPublicGists(user.github_login, githubToken),
    fetchPublicTopRepos(user.github_login, githubToken, 30),
    fetchPublicContributions(user.github_login, githubToken, 365),
    fetchPublicStreak(user.github_login, githubToken, user.timezone),
    fetchPublicTopLanguages(user.github_login, githubToken),
    fetchPublicPullRequests(user.github_login, githubToken),
    options.includeAchievements
      ? syncGitHubAchievementsForUser({
          userId: user.id,
          githubLogin: user.github_login,
          token: githubToken,
        })
      : Promise.resolve({ achievements: [], syncedAt: null, error: null }),
    fetchPinnedRepoDetails(
      user.github_login,
      user.pinned_repos || [],
      githubToken || ""
    ),
    fetchPublicWeeklyGoalProgress(user.id, user.show_weekly_goals ?? false),
  ]);

  // Fetch streak milestones for contribution highlights on public profile
  const { data: streakMilestones } = await supabaseAdmin
    .from("streak_milestones")
    .select("streak_count, achieved_at")
    .eq("user_id", user.id)
    .order("streak_count", { ascending: false })
    .limit(5);

  // Fetch public_widgets preference (added by 20260608000000 migration; falls back gracefully)
  let publicWidgets: PublicWidgetKey[] = ["streak", "contributions"];
  try {
    const { data: widgetsRow } = await supabaseAdmin
      .from("users")
      .select("public_widgets")
      .eq("id", user.id)
      .single();
    if (widgetsRow?.public_widgets && Array.isArray(widgetsRow.public_widgets)) {
      const valid: PublicWidgetKey[] = ["streak", "contributions", "languages", "prs"];
      publicWidgets = (widgetsRow.public_widgets as string[]).filter(
        (w): w is PublicWidgetKey => valid.includes(w as PublicWidgetKey)
      );
    }
  } catch {
    // Column may not exist yet; use defaults
  }

  return {
    username: user.github_login,
    bio: user.bio ?? null,
    isSponsor: user.is_sponsor ?? false,
    publicGists,
    memberSince: user.created_at ?? null,
    repos,
    contributions,
    streak,
    topLanguages,
    pullRequests,
    achievements: achievementsCache.achievements,
    achievementsError: achievementsCache.error,
    spotlightRepos: spotlight,
    contributionMilestones: (streakMilestones ?? []).map((m) => ({
      label: `${m.streak_count}-Day Streak`,
      achievedAt: m.achieved_at ?? null,
    })),
    weeklyGoalProgress,
    publicWidgets,
  };
}