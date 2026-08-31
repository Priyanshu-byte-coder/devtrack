import { githubGraphQL, githubFetch } from "./github-fetch";

export interface AchievementEstimate {
  slug: string;
  title: string;
  current: number;
  nextTier: number | null;
  percentage: number;
  description: string;
}

const TIERS_STANDARD = [1, 16, 128, 1024];
const TIERS_STARSTRUCK = [16, 128, 512, 4096];

export function calculateNextTier(current: number, tiers: number[]): number | null {
  for (const tier of tiers) {
    if (current < tier) return tier;
  }
  return null; // Maxed out
}

export function calculatePercentage(current: number, nextTier: number | null): number {
  if (nextTier === null || current >= nextTier) return 100;
  return Math.floor((current / nextTier) * 100);
}

export async function fetchAchievementEstimates(
  username: string,
  token: string
): Promise<AchievementEstimate[]> {
  const estimates: AchievementEstimate[] = [];

  try {
    // 1. Pull Shark & Galaxy Brain (GraphQL)
    const graphqlQuery = `
      query($login: String!) {
        user(login: $login) {
          pullRequests(states: MERGED) {
            totalCount
          }
          repositoryDiscussionComments(onlyAnswers: true) {
            totalCount
          }
        }
      }
    `;

    const graphqlData = await githubGraphQL<{
      user: {
        pullRequests: { totalCount: number };
        repositoryDiscussionComments: { totalCount: number };
      };
    }>(graphqlQuery, token, { login: username });

    const pullSharkCurrent = graphqlData?.user?.pullRequests?.totalCount ?? 0;
    const pullSharkNext = calculateNextTier(pullSharkCurrent, TIERS_STANDARD);
    estimates.push({
      slug: "pull-shark",
      title: "Pull Shark",
      description: "Merged pull requests",
      current: pullSharkCurrent,
      nextTier: pullSharkNext,
      percentage: calculatePercentage(pullSharkCurrent, pullSharkNext),
    });

    const galaxyBrainCurrent =
      graphqlData?.user?.repositoryDiscussionComments?.totalCount ?? 0;
    const galaxyBrainNext = calculateNextTier(galaxyBrainCurrent, TIERS_STANDARD);
    estimates.push({
      slug: "galaxy-brain",
      title: "Galaxy Brain",
      description: "Accepted answers in discussions",
      current: galaxyBrainCurrent,
      nextTier: galaxyBrainNext,
      percentage: calculatePercentage(galaxyBrainCurrent, galaxyBrainNext),
    });

    // 2. Starstruck (GraphQL - Total Stars)
    // Note: This caps at the first 100 repositories as an approximation.
    const starsQuery = `
      query($login: String!) {
        user(login: $login) {
          repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
            nodes {
              stargazerCount
            }
          }
        }
      }
    `;
    const starsData = await githubGraphQL<{
      user: {
        repositories: {
          nodes: { stargazerCount: number }[];
        };
      };
    }>(starsQuery, token, { login: username });

    const starstruckCurrent =
      starsData?.user?.repositories?.nodes?.reduce(
        (acc, repo) => acc + repo.stargazerCount,
        0
      ) ?? 0;
    const starstruckNext = calculateNextTier(starstruckCurrent, TIERS_STARSTRUCK);
    estimates.push({
      slug: "starstruck",
      title: "Starstruck",
      description: "Total stars on owned repositories",
      current: starstruckCurrent,
      nextTier: starstruckNext,
      percentage: calculatePercentage(starstruckCurrent, starstruckNext),
    });

    // 3. Pair Extraordinaire (REST API - Commit Search)
    try {
      const q = encodeURIComponent(`co-authored-by:${username}`);
      const pairRes = await githubFetch<{ total_count: number }>(
        `https://api.github.com/search/commits?q=${q}&per_page=1`,
        token,
        {
          headers: {
            Accept: "application/vnd.github.cloak-preview+json",
          },
        }
      );
      const pairCurrent = pairRes?.total_count ?? 0;
      const pairNext = calculateNextTier(pairCurrent, TIERS_STANDARD);
      estimates.push({
        slug: "pair-extraordinaire",
        title: "Pair Extraordinaire",
        description: "Co-authored commits",
        current: pairCurrent,
        nextTier: pairNext,
        percentage: calculatePercentage(pairCurrent, pairNext),
      });
    } catch (e) {
      console.warn("Failed to fetch Pair Extraordinaire progress:", e);
      // Fallback if search fails
      estimates.push({
        slug: "pair-extraordinaire",
        title: "Pair Extraordinaire",
        description: "Co-authored commits (Estimator unavailable)",
        current: 0,
        nextTier: 1,
        percentage: 0,
      });
    }
  } catch (error) {
    console.error("Failed to fetch achievement estimates:", error);
  }

  return estimates;
}
