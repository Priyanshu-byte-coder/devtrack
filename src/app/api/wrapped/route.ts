import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { GITHUB_API, GitHubCommitSearchItem } from "@/lib/github";
import {
  calculateLanguagePercentages,
  calculateLongestStreak,
  calculatePersonality,
  getMostContributedRepo,
  getMostProductiveMonth,
  getPeakCodingHour,
  getYearRange,
  type WrappedCommit,
} from "@/lib/wrapped";

export const dynamic = "force-dynamic";

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubCommitSearchItem[];
}

interface GitHubLanguageResponse {
  [language: string]: number;
}

function getRequestedYear(req: NextRequest) {
  const now = new Date();
  const parsed = Number(req.nextUrl.searchParams.get("year"));
  const currentYear = now.getFullYear();

  if (!Number.isInteger(parsed)) {
    return currentYear;
  }

  return Math.min(currentYear, Math.max(2008, parsed));
}

async function fetchYearCommits(
  token: string,
  githubLogin: string,
  startDate: string,
  endDate: string
) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const commits: WrappedCommit[] = [];
  const hours: number[] = [];
  const contributionsByDate: Record<string, number> = {};
  let totalCommits = 0;

  for (let page = 1; page <= 10; page += 1) {
    const searchUrl = new URL(`${GITHUB_API}/search/commits`);
    searchUrl.searchParams.set(
      "q",
      `author:${githubLogin} author-date:${startDate}..${endDate}`
    );
    searchUrl.searchParams.set("per_page", "100");
    searchUrl.searchParams.set("page", String(page));
    searchUrl.searchParams.set("sort", "author-date");
    searchUrl.searchParams.set("order", "desc");

    const res = await fetch(searchUrl.toString(), {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      // On rate-limit, use whatever we've collected so far (including zero)
      // rather than failing the entire request.
      if (res.status === 403 || res.status === 429) {
        break;
      }

      throw new Error(`GitHub commit search failed: ${res.status}`);
    }

    const data = (await res.json()) as GitHubSearchResponse;
    if (page === 1) {
      totalCommits = data.total_count;
    }

    for (const item of data.items) {
      const date = item.commit.author.date.slice(0, 10);
      const hour = new Date(item.commit.author.date).getHours();
      contributionsByDate[date] = (contributionsByDate[date] ?? 0) + 1;
      commits.push({
        date,
        repo: item.repository?.full_name ?? "unknown",
      });
      hours.push(hour);
    }

    if (
      data.items.length < 100 ||
      commits.length >= 1000 ||
      commits.length >= data.total_count
    ) {
      break;
    }
  }

  return { commits, contributionsByDate, hours, totalCommits };
}

async function fetchMergedPRCount(
  token: string,
  githubLogin: string,
  startDate: string,
  endDate: string
) {
  const searchUrl = new URL(`${GITHUB_API}/search/issues`);
  searchUrl.searchParams.set(
    "q",
    `type:pr author:${githubLogin} merged:${startDate}..${endDate}`
  );
  searchUrl.searchParams.set("per_page", "1");

  const res = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return 0;
  }

  const data = (await res.json()) as { total_count: number };
  return data.total_count;
}

async function fetchTopLanguages(token: string, repos: string[]) {
  const langTotals: Record<string, number> = {};
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  // Fetch in batches of 5 to avoid GitHub secondary rate limits
  const repoBatch = repos.slice(0, 10);
  for (let i = 0; i < repoBatch.length; i += 5) {
    await Promise.all(
      repoBatch.slice(i, i + 5).map(async (repo) => {
      try {
        const res = await fetch(`${GITHUB_API}/repos/${repo}/languages`, {
          headers,
          cache: "no-store",
        });

        if (!res.ok) {
          return;
        }

        const languages = (await res.json()) as GitHubLanguageResponse;
        for (const [language, bytes] of Object.entries(languages)) {
          langTotals[language] = (langTotals[language] ?? 0) + bytes;
        }
      } catch (e) {
        // Language data is nice-to-have for the recap. The rest of the wrapped
        // experience should still render if one repository cannot be read.
      }
    })
    );
  }

  return calculateLanguagePercentages(langTotals, 3);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = getRequestedYear(req);
  const { startDate, endDate, partial } = getYearRange(year);

  try {
    const { commits, contributionsByDate, hours, totalCommits } =
      await fetchYearCommits(
        session.accessToken,
        session.githubLogin,
        startDate,
        endDate
      );
    const repos = Array.from(new Set(commits.map((commit) => commit.repo))).filter(
      (repo) => repo !== "unknown"
    );
    const [topLanguages, prsMerged] = await Promise.all([
      fetchTopLanguages(session.accessToken, repos),
      fetchMergedPRCount(
        session.accessToken,
        session.githubLogin,
        startDate,
        endDate
      ),
    ]);

    const activeDays = Object.values(contributionsByDate).filter(
      (count) => count > 0
    ).length;
    const longestStreak = calculateLongestStreak(contributionsByDate);
    const peakCodingHourResult = getPeakCodingHour(hours);

    const personality = calculatePersonality(
      contributionsByDate,
      totalCommits,
      prsMerged,
      peakCodingHourResult,
      longestStreak,
      activeDays
    );

    return Response.json({
      year,
      username: session.githubLogin,
      totalCommits,
      activeDays,
      longestStreak,
      mostProductiveMonth: getMostProductiveMonth(contributionsByDate),
      topLanguages,
      prsMerged,
      mostContributedRepo: getMostContributedRepo(commits),
      peakCodingHour: peakCodingHourResult,
      personality,
      generatedAt: new Date().toISOString(),
      partial,
    });
  } catch (e) {
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}
