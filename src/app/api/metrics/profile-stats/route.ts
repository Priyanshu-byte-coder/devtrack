import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { githubRequest } from "@/lib/github-request";
import { githubRateLimitResponse } from "@/lib/github-rate-limit";

export const dynamic = "force-dynamic";

export interface ProfileStatsResponse {
  memberSince: string;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
  followers: number;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = session.accessToken;

  try {
    const userRes = await githubRequest("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch GitHub user profile" },
        { status: userRes.status }
      );
    }

    const userData = (await userRes.json()) as {
      created_at?: string;
      public_repos?: number;
      followers?: number;
    };

    // Fetch user repos to sum stars and forks
    const reposRes = await githubRequest(
      "https://api.github.com/user/repos?per_page=100&type=owner",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    let totalStars = 0;
    let totalForks = 0;

    if (reposRes.ok) {
      const repos = (await reposRes.json()) as Array<{
        stargazers_count?: number;
        forks_count?: number;
      }>;
      if (Array.isArray(repos)) {
        for (const repo of repos) {
          totalStars += repo.stargazers_count ?? 0;
          totalForks += repo.forks_count ?? 0;
        }
      }
    }

    const stats: ProfileStatsResponse = {
      memberSince: userData.created_at ?? new Date().toISOString(),
      publicRepos: userData.public_repos ?? 0,
      totalStars,
      totalForks,
      followers: userData.followers ?? 0,
    };

    return NextResponse.json(stats);
  } catch (err) {
    const rl = githubRateLimitResponse(err);
    if (rl) return rl;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
