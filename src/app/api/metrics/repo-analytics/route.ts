import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { isMetricsCacheBypassed, metricsCacheKey, withMetricsCache } from "@/lib/metrics-cache";
import { computeHealthScore } from "@/lib/repo-health";
import { RepoAnalyticsResponse } from "@/lib/repo-analytics-types";
import { isSafeUrl } from "@/lib/ssrf-protection";
import { parseRepoParam } from "@/lib/repo-analytics-utils";

export const dynamic = "force-dynamic";
const GITHUB_API = "https://api.github.com";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawRepo = req.nextUrl.searchParams.get("repo");
  if (!rawRepo) {
    return Response.json({ error: "Missing repo parameter" }, { status: 400 });
  }

  const parsed = parseRepoParam(rawRepo);
  if (!parsed) {
    return Response.json(
      { error: "Invalid repo parameter. Expected format: owner/repo (e.g. octocat/Hello-World)" },
      { status: 400 }
    );
  }

  const { owner, repo } = parsed;
  const safeRepoPath = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const repoUrl = `${GITHUB_API}/repos/${safeRepoPath}`;
  let urlSafe = false;
  try {
    urlSafe = await isSafeUrl(repoUrl);
  } catch {
    urlSafe = false;
  }
  if (!urlSafe) {
    return Response.json({ error: "Invalid repository URL" }, { status: 400 });
  }

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(
    session.githubId ?? session.githubLogin,
    `repo-analytics-${owner}/${repo}` as any,
    { days: 30 }
  );

  try {
    const data = await withMetricsCache({ bypass, key, ttlSeconds: 60 * 60 }, async () => {
      const repoRes = await fetch(repoUrl, {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      if (!repoRes.ok) throw new Error("API error fetching repo overview");
      const repoData = await repoRes.json();

      const contribRes = await fetch(`${GITHUB_API}/repos/${safeRepoPath}/contributors?per_page=10`, {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      const contribData = contribRes.ok ? await contribRes.json() : [];

      const langRes = await fetch(`${GITHUB_API}/repos/${safeRepoPath}/languages`, {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      const langData = langRes.ok ? await langRes.json() : {};

      const totalBytes = Object.values(langData).reduce((a: any, b: any) => a + b, 0) as number;
      const languageBreakdown = Object.entries(langData)
        .map(([name, bytes]: [string, any], index) => ({
          name,
          percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0,
          color: COLORS[index % COLORS.length]
        }))
        .sort((a, b) => b.percentage - a.percentage);

      const primaryStack = languageBreakdown.slice(0, 3).map((l) => l.name);

      const activityRes = await fetch(`${GITHUB_API}/repos/${safeRepoPath}/stats/commit_activity`, {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });

      let timeline: { date: string; events: number }[] = [];
      let statsBuilding = false;

      if (activityRes.status === 202) {
        // GitHub is computing stats asynchronously; surface this to the caller
        statsBuilding = true;
      } else if (activityRes.ok) {
        const activityData = await activityRes.json();
        if (Array.isArray(activityData) && activityData.length > 0) {
          const lastWeek = activityData[activityData.length - 1];
          const days: number[] = lastWeek.days || [];
          // `lastWeek.week` is a Unix timestamp (seconds) for the Sunday that starts the bucket.
          // Derive labels from it so they always match the actual calendar days GitHub recorded.
          const weekStart = new Date((lastWeek.week as number) * 1000);
          for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setUTCDate(d.getUTCDate() + i);
            timeline.push({
              date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
              events: days[i] ?? 0,
            });
          }
        }
      }

      if (timeline.length === 0) {
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          timeline.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), events: 0 });
        }
      }

      const healthSignals = {
        commitFrequency: timeline.reduce((a, b) => a + b.events, 0),
        prMergeRate: 0.8,
        avgPrOpenTimeHours: 24,
        openIssuesCount: repoData.open_issues_count || 0,
        daysSinceLastCommit: 1,
        contributorCount: 0,
        documentationScore: 0,
      };

      const health = computeHealthScore(repoData.name, healthSignals);

      // Fetch PR activity for this repo (Issue 1: top repos by PR activity)
      const prRes = await fetch(`${GITHUB_API}/repos/${safeRepoPath}/pulls?state=all&per_page=1`, {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      const prLinkHeader = prRes.headers.get("link") ?? "";
      const prLastMatch = prLinkHeader.match(/page=(\d+)>; rel="last"/);
      const totalPrs = prLastMatch ? parseInt(prLastMatch[1], 10) : (prRes.ok ? 1 : 0);

      const result: RepoAnalyticsResponse = {
        overview: {
          description: repoData.description,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          openIssues: repoData.open_issues_count,
          watchers: repoData.subscribers_count || repoData.watchers_count || 0,
          license: repoData.license?.name || "No License",
          defaultBranch: repoData.default_branch,
          createdAt: repoData.created_at,
          updatedAt: repoData.updated_at,
        },
        contributors: Array.isArray(contribData) ? contribData.map((c: any) => ({
          login: c.login,
          avatarUrl: c.avatar_url,
          contributions: c.contributions
        })) : [],
        timeline,
        health,
        primaryStack,
        languageBreakdown,
        prActivity: { total: totalPrs },
        ...(statsBuilding ? { statsBuilding: true } : {}),
      };

      return result;
    });

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "GitHub API error" }, { status: 502 });
  }
}