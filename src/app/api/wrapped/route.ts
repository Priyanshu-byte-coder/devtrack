import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubRequest } from "@/lib/github-request";
import { getServerSession } from "@/lib/server-session";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { GITHUB_API, GitHubCommitSearchItem } from "@/lib/github";
import {
  isMetricsCacheBypassed,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";
import {
  calculateLanguagePercentages,
  calculateLongestStreak,
  calculatePersonality,
  getMostProductiveMonth,
  getPeakCodingHour,
  getYearRange,
} from "@/lib/wrapped";

export const dynamic = "force-dynamic";

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubCommitSearchItem[];
}

interface YearQueryResult {
  user: {
    contributionsCollection: {
      totalCommitContributions: number;
      contributionCalendar: {
        weeks: Array<{
          contributionDays: Array<{ date: string; contributionCount: number }>;
        }>;
      };
      commitContributionsByRepository: Array<{
        contributions: { totalCount: number };
        repository: {
          nameWithOwner: string;
          isPrivate: boolean;
          languages: {
            edges: Array<{ size: number; node: { name: string } }>;
          };
        };
      }>;
    };
  } | null;
  merged: { issueCount: number };
}

// Everything but the coding clock in one request: the year's calendar,
// commit total, top repositories with their languages and merged PRs. It used
// to take ten pages of commit search plus a request per repository.
const YEAR_QUERY = `
query YearInCode($login: String!, $from: DateTime!, $to: DateTime!, $merged: String!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
      commitContributionsByRepository(maxRepositories: 10) {
        contributions { totalCount }
        repository {
          nameWithOwner
          isPrivate
          languages(first: 5, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name } }
          }
        }
      }
    }
  }
  merged: search(query: $merged, type: ISSUE, first: 1) { issueCount }
}`;

// A past year never changes; the current one is fine a few hours stale.
const PAST_YEAR_TTL_SECONDS = 7 * 24 * 60 * 60;
const CURRENT_YEAR_TTL_SECONDS = 6 * 60 * 60;

function getRequestedYear(req: NextRequest) {
  const now = new Date();
  const parsed = Number(req.nextUrl.searchParams.get("year"));
  const currentYear = now.getFullYear();

  if (!Number.isInteger(parsed)) {
    return currentYear;
  }

  return Math.min(currentYear, Math.max(2008, parsed));
}

async function fetchYearSummary(
  token: string,
  githubLogin: string,
  start: Date,
  end: Date,
  startDate: string,
  endDate: string
) {
  const res = await githubRequest("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: YEAR_QUERY,
      variables: {
        login: githubLogin,
        from: start.toISOString(),
        to: end.toISOString(),
        merged: `type:pr author:${githubLogin} merged:${startDate}..${endDate}`,
      },
    }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL failed: ${res.status}`);
  const json = (await res.json()) as { data?: YearQueryResult };
  const collection = json.data?.user?.contributionsCollection;
  if (!collection) throw new Error("GitHub returned no contribution data");

  const contributionsByDate: Record<string, number> = {};
  for (const week of collection.contributionCalendar.weeks)
    for (const day of week.contributionDays)
      if (day.date >= startDate && day.date <= endDate)
        contributionsByDate[day.date] = day.contributionCount;

  const repos = collection.commitContributionsByRepository;
  const langTotals: Record<string, number> = {};
  for (const { repository } of repos)
    for (const edge of repository.languages.edges)
      langTotals[edge.node.name] =
        (langTotals[edge.node.name] ?? 0) + edge.size;

  // The recap is made to be shared, so it never names a private repository.
  const topPublic = repos
    .filter((r) => !r.repository.isPrivate)
    .sort((a, b) => b.contributions.totalCount - a.contributions.totalCount)[0];

  return {
    totalCommits: collection.totalCommitContributions,
    contributionsByDate,
    topLanguages: calculateLanguagePercentages(langTotals, 3),
    mostContributedRepo: topPublic
      ? {
          name: topPublic.repository.nameWithOwner,
          commits: topPublic.contributions.totalCount,
        }
      : { name: "No public repository", commits: 0 },
    prsMerged: json.data?.merged.issueCount ?? 0,
  };
}

/** Hours only come from commit timestamps: one page of the latest commits. */
async function fetchCommitHours(
  token: string,
  githubLogin: string,
  startDate: string,
  endDate: string
): Promise<number[]> {
  const searchUrl = new URL(`${GITHUB_API}/search/commits`);
  searchUrl.searchParams.set(
    "q",
    `author:${githubLogin} author-date:${startDate}..${endDate}`
  );
  searchUrl.searchParams.set("per_page", "100");
  searchUrl.searchParams.set("sort", "author-date");
  searchUrl.searchParams.set("order", "desc");

  try {
    const res = await githubRequest(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as GitHubSearchResponse;
    return data.items.map((item) =>
      new Date(item.commit.author.date).getHours()
    );
  } catch {
    // The coding clock is a nice-to-have; the recap renders without it.
    return [];
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = getRequestedYear(req);
  const { start, end, startDate, endDate, partial } = getYearRange(year);

  const userId = session.githubId ?? session.githubLogin;
  const key = metricsCacheKey(userId, "wrapped", { year });

  try {
    const stats = await withMetricsCache(
      {
        bypass: isMetricsCacheBypassed(req),
        key,
        ttlSeconds: partial ? CURRENT_YEAR_TTL_SECONDS : PAST_YEAR_TTL_SECONDS,
      },
      async () => {
        const [summary, hours] = await Promise.all([
          fetchYearSummary(
            session.accessToken!,
            session.githubLogin!,
            start,
            end,
            startDate,
            endDate
          ),
          fetchCommitHours(
            session.accessToken!,
            session.githubLogin!,
            startDate,
            endDate
          ),
        ]);
        const { contributionsByDate, totalCommits, prsMerged } = summary;
        const activeDays = Object.values(contributionsByDate).filter(
          (count) => count > 0
        ).length;
        const longestStreak = calculateLongestStreak(contributionsByDate);
        const peakCodingHour = getPeakCodingHour(hours);

        return {
          year,
          username: session.githubLogin!,
          totalCommits,
          activeDays,
          longestStreak,
          mostProductiveMonth: getMostProductiveMonth(contributionsByDate),
          topLanguages: summary.topLanguages,
          prsMerged,
          mostContributedRepo: summary.mostContributedRepo,
          peakCodingHour,
          personality: calculatePersonality(
            contributionsByDate,
            totalCommits,
            prsMerged,
            peakCodingHour,
            longestStreak,
            activeDays
          ),
          generatedAt: new Date().toISOString(),
          partial,
        };
      }
    );

    return Response.json(stats);
  } catch (e) {
    const githubLimit = githubRateLimitResponse(e);
    if (githubLimit) return githubLimit;

    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
