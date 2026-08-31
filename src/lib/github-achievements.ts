import { supabaseAdmin } from "@/lib/supabase";

const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";
const GITHUB_WEB_URL = "https://github.com";
const ACHIEVEMENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const GITHUB_WEB_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "DevTrack achievement sync",
};

export interface GitHubAchievement {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}

export interface GitHubAchievementsCache {
  achievements: GitHubAchievement[];
  syncedAt: string | null;
  error?: string | null;
}

interface GitHubUserGraphQLResponse {
  data?: {
    user?: {
      login: string;
      url: string;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

interface GitHubAchievementRow {
  achievements: GitHubAchievement[] | null;
  synced_at: string | null;
  fetch_error?: string | null;
}

const ACHIEVEMENT_DESCRIPTIONS: Record<string, string> = {
  "arctic-code-vault-contributor":
    "Contributed code to repositories preserved in the 2020 GitHub Arctic Code Vault.",
  "galaxy-brain": "Answered discussions with replies marked as accepted.",
  "pair-extraordinaire": "Coauthored commits that were merged into a repository.",
  "pull-shark": "Opened pull requests that were merged.",
  quickdraw: "Closed an issue or pull request shortly after opening it.",
  starstruck: "Created a repository that earned stars.",
  yolo: "Merged a pull request without a review.",
};

function logGitHubAchievements(
  level: "error" | "warn" | "info",
  payload: Record<string, unknown>
): void {
  const message = JSON.stringify({
    event: "github_achievements_sync",
    timestamp: new Date().toISOString(),
    ...payload,
  });

  if (level === "error") {
    console.error(message);
  } else if (level === "warn") {
    console.warn(message);
  } else {
    console.info(message);
  }
}

/**
 * Decodes common HTML entities in a given string.
 * @param value - The string containing HTML entities.
 * @returns The decoded string.
 */
export function decodeHtml(value: string): string {
  // Decode &amp; last to avoid double-decoding entity sequences like &amp;lt;
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Removes all HTML tags from a string and normalizes whitespace.
 * @param value - The HTML string.
 * @returns The plain text string without tags.
 */
export function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

/**
 * Converts a hyphenated slug into a capitalized title.
 * @param slug - The achievement slug (e.g., "pull-shark").
 * @returns The formatted title (e.g., "Pull Shark").
 */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Converts a title into a hyphenated slug suitable for URLs.
 * @param title - The achievement title.
 * @returns The generated slug.
 */
export function slugFromTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function achievementDescription(slug: string, title: string): string {
  return ACHIEVEMENT_DESCRIPTIONS[slug] ?? `${title} achievement on GitHub.`;
}

/**
 * Ensures a given GitHub URL is absolute, prefixing it with the base GitHub URL if necessary.
 * @param value - The URL to process.
 * @returns The absolute GitHub URL.
 */
export function absoluteGitHubUrl(value: string): string {
  const decoded = decodeHtml(value);
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return decoded;
  }
  if (decoded.startsWith("//")) {
    return `https:${decoded}`;
  }
  if (decoded.startsWith("/")) {
    return `${GITHUB_WEB_URL}${decoded}`;
  }
  return decoded;
}

/**
 * Extracts the value of a specific HTML attribute from a given HTML tag string.
 * @param tag - The HTML tag string.
 * @param attribute - The name of the attribute to extract.
 * @returns The attribute value, or null if not found.
 */
export function getHtmlAttribute(tag: string, attribute: string): string | null {
  const pattern = new RegExp(`${attribute}="([^"]*)"`, "i");
  const match = tag.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

/**
 * Extracts the achievement slug from its image URL.
 * @param imageUrl - The URL of the achievement image.
 * @returns The extracted slug, or null if it cannot be determined.
 */
export function slugFromAchievementImage(imageUrl: string): string | null {
  const fileName = imageUrl.split("/").pop()?.split("?")[0] ?? "";
  const match = fileName.match(/^(.+?)(?:-(?:default|badge|dark|light))?-[a-f0-9]{6,}\.png$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Sanitizes a GitHub username by removing leading '@' and whitespace.
 * @param username - The raw username.
 * @returns The sanitized username.
 */
export function sanitizeGitHubLogin(username: string): string {
  return username.trim().replace(/^@/, "");
}

async function fetchCanonicalGitHubUser(
  username: string,
  token?: string
): Promise<{ login: string; url: string }> {
  const fallback = {
    login: sanitizeGitHubLogin(username),
    url: `${GITHUB_WEB_URL}/${encodeURIComponent(sanitizeGitHubLogin(username))}`,
  };

  if (!token) {
    return fallback;
  }

  try {
    const response = await fetch(GITHUB_GRAPHQL_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        query: `
          query DevTrackGitHubAchievementsUser($login: String!) {
            user(login: $login) {
              login
              url
            }
          }
        `,
        variables: { login: fallback.login },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      logGitHubAchievements("warn", {
        githubLogin: fallback.login,
        stage: "graphql_user_lookup",
        status: response.status,
        message: "GitHub GraphQL lookup failed; falling back to public profile HTML",
      });
      return fallback;
    }

    const data = (await response.json()) as GitHubUserGraphQLResponse;
    const user = data.data?.user;

    if (!user) {
      logGitHubAchievements("warn", {
        githubLogin: fallback.login,
        stage: "graphql_user_lookup",
        message: data.errors?.[0]?.message ?? "GitHub user not found",
      });
      return fallback;
    }

    return user;
  } catch (error) {
    logGitHubAchievements("warn", {
      githubLogin: fallback.login,
      stage: "graphql_user_lookup",
      message: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

function parseAchievementsFromProfileHtml(
  html: string,
  githubProfileUrl: string
): GitHubAchievement[] {
  const achievements = new Map<string, GitHubAchievement>();
  const anchorPattern =
    /<a\b[^>]*href="([^"]*\/achievements\/([^"?/#]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1];
    const slug = decodeHtml(match[2]).toLowerCase();
    const anchorHtml = match[3];
    const imgMatch = anchorHtml.match(/<img alt="" aria-hidden="true"\b[^>]*src="([^"]+)"[^>]*>/i);

    if (!imgMatch) {
      continue;
    }

    const imageUrl = absoluteGitHubUrl(imgMatch[1]);
    const altMatch = anchorHtml.match(/<img alt="" aria-hidden="true"\b[^>]*alt="([^"]*)"[^>]*>/i);
    const ariaMatch = anchorHtml.match(/aria-label="([^"]+)"/i);
    const titleMatch = anchorHtml.match(/title="([^"]+)"/i);
    const rawTitle =
      altMatch?.[1] || ariaMatch?.[1] || titleMatch?.[1] || titleFromSlug(slug);
    const title = stripTags(rawTitle.replace(/^Achievement:\s*/i, "")) || titleFromSlug(slug);

    achievements.set(slug, {
      slug,
      title,
      description: achievementDescription(slug, title),
      imageUrl,
      url: githubProfileUrl,
    });
  }

  const achievementImagePattern = /<img alt="" aria-hidden="true"\b[^>]*alt="Achievement:\s*([^"]+)"[^>]*>/gi;

  for (const match of html.matchAll(achievementImagePattern)) {
    const imageTag = match[0];
    const title = stripTags(match[1]) || "GitHub Achievement";
    const imageUrl = absoluteGitHubUrl(getHtmlAttribute(imageTag, "src") ?? "");
    const hovercardUrl = getHtmlAttribute(imageTag, "data-hovercard-url");
    const hovercardSlug = hovercardUrl?.match(/\/achievements\/([^/"]+)\/detail/i)?.[1];
    const imageSlug = slugFromAchievementImage(imageUrl);
    const slug = (hovercardSlug ?? imageSlug ?? slugFromTitle(title)).toLowerCase();

    if (!slug || !imageUrl) {
      continue;
    }

    achievements.set(slug, {
      slug,
      title,
      description: achievementDescription(slug, title),
      imageUrl,
      url: `${githubProfileUrl}?achievement=${encodeURIComponent(slug)}&tab=achievements`,
    });
  }

  return [...achievements.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Fetches the GitHub achievements for a specific user from their public profile HTML.
 * @param username - The GitHub username.
 * @param token - Optional GitHub personal access token for higher rate limits.
 * @returns An array of fetched achievements.
 */
export async function fetchGitHubAchievements(
  username: string,
  token?: string
): Promise<GitHubAchievement[]> {
  const user = await fetchCanonicalGitHubUser(username, token);
  const response = await fetch(user.url, {
    headers: GITHUB_WEB_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GitHub profile fetch error: ${response.status}`);
  }

  const html = await response.text();
  const achievements = parseAchievementsFromProfileHtml(html, user.url);

  logGitHubAchievements("info", {
    githubLogin: user.login,
    stage: "profile_html_parse",
    achievementCount: achievements.length,
  });

  return achievements;
}

/**
 * Retrieves the cached GitHub achievements for a user from the database.
 * @param userId - The user's internal ID.
 * @returns The cached achievements data, or null if not found.
 */
export async function getCachedGitHubAchievements(
  userId: string
): Promise<GitHubAchievementsCache | null> {
  const { data, error } = await supabaseAdmin
    .from("user_github_achievements")
    .select("achievements,synced_at,fetch_error")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching GitHub achievements cache:", error);
    return null;
  }

  const row = data as GitHubAchievementRow;

  return {
    achievements: row.achievements ?? [],
    syncedAt: row.synced_at,
    error: row.fetch_error ?? null,
  };
}

/**
 * Syncs a user's GitHub achievements, using cached data if fresh, or fetching new data if necessary.
 * @param options - Configuration options for the sync operation.
 * @returns The synced achievements cache object.
 */
export async function syncGitHubAchievementsForUser(options: {
  userId: string;
  githubLogin: string;
  token?: string;
  force?: boolean;
}): Promise<GitHubAchievementsCache> {
  const cached = await getCachedGitHubAchievements(options.userId);
  const syncedAt = cached?.syncedAt ? new Date(cached.syncedAt).getTime() : 0;

  if (
    !options.force &&
    cached &&
    (!cached.error || cached.achievements.length > 0) &&
    Number.isFinite(syncedAt) &&
    Date.now() - syncedAt < ACHIEVEMENT_CACHE_TTL_MS
  ) {
    return cached;
  }

  try {
    logGitHubAchievements("info", {
      userId: options.userId,
      githubLogin: options.githubLogin,
      stage: "sync_start",
      force: Boolean(options.force),
    });

    const achievements = await fetchGitHubAchievements(
      options.githubLogin,
      options.token
    );
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("user_github_achievements").upsert(
      {
        user_id: options.userId,
        github_login: options.githubLogin,
        achievements,
        synced_at: now,
        fetch_error: null,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      logGitHubAchievements("error", {
        userId: options.userId,
        githubLogin: options.githubLogin,
        stage: "cache_write_failure",
        message: error.message,
        achievementCount: achievements.length,
      });

      return { achievements, syncedAt: now, error: error.message };
    }

    logGitHubAchievements("info", {
      userId: options.userId,
      githubLogin: options.githubLogin,
      stage: "sync_success",
      achievementCount: achievements.length,
    });

    return { achievements, syncedAt: now, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync GitHub achievements";
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("user_github_achievements")
      .upsert(
        {
          user_id: options.userId,
          github_login: options.githubLogin,
          achievements: cached?.achievements ?? [],
          synced_at: cached?.syncedAt ?? now,
          fetch_error: message,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );

    if (updateError) {
      console.error("Error updating GitHub achievements sync status:", updateError);
    }

    logGitHubAchievements("error", {
      userId: options.userId,
      githubLogin: options.githubLogin,
      stage: "sync_failure",
      message,
      cachedAchievementCount: cached?.achievements.length ?? 0,
    });

    return {
      achievements: cached?.achievements ?? [],
      syncedAt: cached?.syncedAt ?? null,
      error: cached?.achievements.length ? message : null,
    };
  }
}
