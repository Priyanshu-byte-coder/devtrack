/**
 * Guest profiles: a page for any GitHub login, built from public GitHub data,
 * for people who have not signed up to DevTrack. Pure helpers live here so
 * they can be tested without the network; fetching is in guest-profile.ts.
 */

import type { LeaderboardEntry } from "@/lib/leaderboard";
import type { PublicLanguage } from "@/lib/public-profile-data";
import {
  scoreCohort,
  tierForScore,
  xpFromTotals,
  type ActivityStats,
  type Tier,
} from "@/lib/gamification/scoring";
import { calculateStreakFromDates } from "@/lib/streak";

export interface GuestRepo {
  name: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
}

export interface GuestProfile {
  login: string;
  name: string | null;
  bio: string | null;
  /** When the GitHub account was created. */
  githubSince: string;
  followers: number;
  publicRepos: number;
  publicGists: number;
  /** Contributions per day over the last year, oldest first. */
  calendar: Array<{ date: string; count: number }>;
  /** Contributions over the last year, as GitHub's profile shows them. */
  yearContributions: number;
  activeDays: number;
  streak: { current: number; longest: number };
  /** All-time totals across every contribution year. */
  lifetime: { commits: number; prs: number; reviews: number };
  /** Repositories committed to over the last year. */
  reposContributed: number;
  topRepos: GuestRepo[];
  topLanguages: PublicLanguage[];
}

/** GitHub's GraphQL `user` shape for the guest query. */
export interface GuestUserNode {
  login: string;
  name: string | null;
  bio: string | null;
  createdAt: string;
  followers: { totalCount: number };
  gists: { totalCount: number };
  repositories: {
    totalCount: number;
    nodes: Array<{
      name: string;
      url: string;
      description: string | null;
      stargazerCount: number;
      primaryLanguage: { name: string } | null;
    } | null>;
  };
  contributionsCollection: {
    contributionYears: number[];
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalRepositoriesWithContributedCommits: number;
    contributionCalendar: {
      totalContributions: number;
      weeks: Array<{
        contributionDays: Array<{ date: string; contributionCount: number }>;
      }>;
    };
  };
}

export type YearTotals = {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
};

export function buildGuestProfile(
  user: GuestUserNode,
  lifetimeByYear: YearTotals[] | null
): GuestProfile {
  const cc = user.contributionsCollection;
  const calendar = cc.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));
  const active = calendar.filter((d) => d.count > 0).map((d) => d.date);
  const streak = calculateStreakFromDates(new Set(active));

  // Without the per-year breakdown, the last year is the best lower bound.
  const lifetime = lifetimeByYear?.length
    ? {
        commits: sum(lifetimeByYear, "totalCommitContributions"),
        prs: sum(lifetimeByYear, "totalPullRequestContributions"),
        reviews: sum(lifetimeByYear, "totalPullRequestReviewContributions"),
      }
    : {
        commits: cc.totalCommitContributions,
        prs: cc.totalPullRequestContributions,
        reviews: cc.totalPullRequestReviewContributions,
      };

  const repos = user.repositories.nodes.filter(
    (r): r is NonNullable<typeof r> => r !== null
  );

  return {
    login: user.login,
    name: user.name?.trim() || null,
    bio: user.bio?.trim() || null,
    githubSince: user.createdAt,
    followers: user.followers.totalCount,
    publicRepos: user.repositories.totalCount,
    publicGists: user.gists.totalCount,
    calendar,
    yearContributions: cc.contributionCalendar.totalContributions,
    activeDays: active.length,
    streak: { current: streak.current, longest: streak.longest },
    lifetime,
    reposContributed: cc.totalRepositoriesWithContributedCommits,
    topRepos: [...repos]
      .sort((a, b) => b.stargazerCount - a.stargazerCount)
      .slice(0, 6)
      .map((r) => ({
        name: r.name,
        url: r.url,
        description: r.description,
        stars: r.stargazerCount,
        language: r.primaryLanguage?.name ?? null,
      })),
    topLanguages: languageShare(repos.map((r) => r.primaryLanguage?.name)),
  };
}

function sum(rows: YearTotals[], key: keyof YearTotals) {
  return rows.reduce((total, row) => total + (row[key] ?? 0), 0);
}

function languageShare(languages: Array<string | undefined>): PublicLanguage[] {
  const counts = new Map<string, number>();
  for (const lang of languages)
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);
}

/**
 * Whether a guest page is worth a place in search results. Pages for empty
 * or brand-new accounts would be thin content: search engines see thousands
 * of near-identical pages and trust the whole site less. Those still render
 * for people who follow a link, with `noindex`.
 */
export function isIndexableGuest(profile: GuestProfile, now = new Date()) {
  const ageDays =
    (now.getTime() - new Date(profile.githubSince).getTime()) / 86_400_000;
  if (!(ageDays >= 90)) return false;
  if (profile.followers >= 50) return true;
  return profile.yearContributions >= 50 && profile.activeDays >= 10;
}

/** The all-time board's inputs for this guest, as the leaderboard computes them. */
export function guestActivityStats(profile: GuestProfile): ActivityStats {
  return {
    activeDays: profile.activeDays,
    streak: profile.streak.current,
    commits: profile.lifetime.commits,
    prs: profile.lifetime.prs,
    reviews: profile.lifetime.reviews,
    repos: profile.reposContributed,
  };
}

export interface GuestRankEstimate {
  rank: number;
  /** People on the board once the guest joins it. */
  total: number;
  scoreV2: number;
  tier: Tier;
  xp: number;
}

/**
 * Where a guest would land on the all-time board if they joined today.
 * Scores are relative to the cohort, so the guest is scored together with
 * everyone on the board, exactly as the nightly build would.
 */
export function estimateGuestRank(
  profile: GuestProfile,
  entries: LeaderboardEntry[]
): GuestRankEstimate {
  const byId = new Map<string, LeaderboardEntry>();
  for (const e of entries) if (!byId.has(e.id)) byId.set(e.id, e);
  const others = [...byId.values()].filter(
    (e) => e.username.toLowerCase() !== profile.login.toLowerCase()
  );

  const cohort: ActivityStats[] = [
    guestActivityStats(profile),
    ...others.map((e) => ({
      activeDays: e.activeDays ?? 0,
      streak: e.streak,
      commits: e.commits,
      prs: e.prs,
      reviews: e.reviews ?? 0,
      repos: e.repos ?? 0,
    })),
  ];
  const [guestScore, ...otherScores] = scoreCohort(cohort, "all");
  const ahead = otherScores.filter((s) => s > guestScore).length;

  return {
    rank: ahead + 1,
    total: others.length + 1,
    scoreV2: guestScore,
    tier: tierForScore(guestScore),
    xp: xpFromTotals(profile.lifetime),
  };
}
