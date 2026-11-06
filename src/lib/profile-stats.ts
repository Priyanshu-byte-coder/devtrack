/**
 * Public profile stats from a single GitHub GraphQL request.
 *
 * Member profiles used to assemble these from paged commit searches (30 days
 * of commits twice, a year of commits for the streak) plus REST calls: up to
 * a dozen requests per profile, against a search limit of 30 a minute. One
 * GraphQL query returns the same picture for a point or two.
 *
 * Pure helpers live here; the request is made by fetchProfileStatsGraphql.
 */

import type {
  ContributionData,
  PublicLanguage,
  TopRepo,
} from "@/lib/public-profile-data";

export const PROFILE_STATS_QUERY = `
query ProfileStats($login: String!, $since: DateTime!) {
  user(login: $login) {
    pullRequests { totalCount }
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 30, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes { primaryLanguage { name } }
    }
    year: contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
    recent: contributionsCollection(from: $since) {
      commitContributionsByRepository(maxRepositories: 25) {
        repository { nameWithOwner url isPrivate }
        contributions(first: 100) { nodes { occurredAt commitCount } }
      }
    }
  }
}`;

export interface ProfileStatsNode {
  pullRequests: { totalCount: number };
  repositories: {
    nodes: Array<{ primaryLanguage: { name: string } | null } | null>;
  };
  year: {
    contributionCalendar: {
      weeks: Array<{
        contributionDays: Array<{ date: string; contributionCount: number }>;
      }>;
    };
  };
  recent: {
    commitContributionsByRepository: Array<{
      repository: { nameWithOwner: string; url: string; isPrivate: boolean };
      contributions: {
        nodes: Array<{ occurredAt: string; commitCount: number } | null>;
      };
    }>;
  };
}

export interface ProfileStats {
  pullRequests: number;
  /** Public commits per day over the window, and their total. */
  contributions: ContributionData;
  /** Up to six public repositories by commits in the window. */
  repos: TopRepo[];
  topLanguages: PublicLanguage[];
  /** Days with any contribution in the last year, for the streak. */
  activeDates: Set<string>;
}

export function buildProfileStats(
  user: ProfileStatsNode,
  windowDays: number
): ProfileStats {
  // Only public repositories: a token that can see private ones must not
  // leak them onto a public page.
  const publicRepos = user.recent.commitContributionsByRepository.filter(
    (r) => !r.repository.isPrivate
  );

  const byDay: Record<string, number> = {};
  const repos: TopRepo[] = [];
  for (const entry of publicRepos) {
    let commits = 0;
    for (const node of entry.contributions.nodes) {
      if (!node || node.commitCount <= 0) continue;
      const day = node.occurredAt.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + node.commitCount;
      commits += node.commitCount;
    }
    if (commits > 0) {
      repos.push({
        name: entry.repository.nameWithOwner,
        url: entry.repository.url,
        commits,
      });
    }
  }
  repos.sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  const total = Object.values(byDay).reduce((a, b) => a + b, 0);

  const counts = new Map<string, number>();
  for (const repo of user.repositories.nodes) {
    const lang = repo?.primaryLanguage?.name;
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const langTotal = [...counts.values()].reduce((a, b) => a + b, 0);
  const topLanguages: PublicLanguage[] =
    langTotal === 0
      ? []
      : [...counts.entries()]
          .map(([name, count]) => ({
            name,
            count,
            percentage: Math.round((count / langTotal) * 1000) / 10,
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          .slice(0, 5);

  const activeDates = new Set(
    user.year.contributionCalendar.weeks
      .flatMap((w) => w.contributionDays)
      .filter((d) => d.contributionCount > 0)
      .map((d) => d.date)
  );

  return {
    pullRequests: user.pullRequests.totalCount,
    contributions: {
      days: windowDays,
      total,
      data: byDay,
      complete: true,
    },
    repos: repos.slice(0, 6),
    topLanguages,
    activeDates,
  };
}
