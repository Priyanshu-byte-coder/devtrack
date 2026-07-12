import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { supabaseAdmin } from "@/lib/supabase";
import {
  isMetricsCacheBypassed,
  metricsCacheKey,
  withMetricsCache,
} from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

export interface DevTrackBadge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  earned: boolean;
  earnedAt: string | null;
}

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  emoji: string;
  check: (stats: UserStats) => boolean;
}

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalCommits: number;
  totalPrs: number;
  totalReviews: number;
  openSourcePrs: number;
  issuesClosed: number;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "streak-7",
    title: "Week Warrior",
    description: "Maintained a 7-day commit streak",
    emoji: "🔥",
    check: (s) => s.currentStreak >= 7 || s.longestStreak >= 7,
  },
  {
    id: "streak-30",
    title: "Month Master",
    description: "Maintained a 30-day commit streak",
    emoji: "🌟",
    check: (s) => s.currentStreak >= 30 || s.longestStreak >= 30,
  },
  {
    id: "streak-100",
    title: "Century Coder",
    description: "Maintained a 100-day commit streak",
    emoji: "💯",
    check: (s) => s.currentStreak >= 100 || s.longestStreak >= 100,
  },
  {
    id: "commits-100",
    title: "100 Commits",
    description: "Made 100 total commits",
    emoji: "⚡",
    check: (s) => s.totalCommits >= 100,
  },
  {
    id: "commits-500",
    title: "500 Commits",
    description: "Made 500 total commits",
    emoji: "🚀",
    check: (s) => s.totalCommits >= 500,
  },
  {
    id: "first-open-source-pr",
    title: "Open Source Hero",
    description: "Merged your first PR to someone else's repository",
    emoji: "🌐",
    check: (s) => s.openSourcePrs >= 1,
  },
  {
    id: "open-source-10",
    title: "Community Contributor",
    description: "Merged 10 open source PRs",
    emoji: "🤝",
    check: (s) => s.openSourcePrs >= 10,
  },
  {
    id: "review-master",
    title: "Review Master",
    description: "Submitted 50 code reviews",
    emoji: "🔍",
    check: (s) => s.totalReviews >= 50,
  },
  {
    id: "issue-closer-25",
    title: "Bug Squasher",
    description: "Closed 25 issues",
    emoji: "🐛",
    check: (s) => s.issuesClosed >= 25,
  },
  {
    id: "pr-10",
    title: "PR Pro",
    description: "Merged 10 pull requests",
    emoji: "🎯",
    check: (s) => s.totalPrs >= 10,
  },
];

async function fetchUserStats(
  userId: string,
  githubLogin: string,
  token: string
): Promise<UserStats> {
  const GITHUB_API = "https://api.github.com";
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceStr = since.toISOString().slice(0, 10);

  // Fetch streak data from DB
  const { data: streakMilestones } = await supabaseAdmin
    .from("streak_milestones")
    .select("streak_count")
    .eq("user_id", userId)
    .order("streak_count", { ascending: false })
    .limit(1);
  const longestStreak = streakMilestones?.[0]?.streak_count ?? 0;

  // Fetch current streak from freezes + commits (simplified: use milestone table)
  const { data: freezes } = await supabaseAdmin
    .from("streak_freezes")
    .select("freeze_date")
    .eq("user_id", userId)
    .gte("freeze_date", sinceStr);
  const freezeCount = freezes?.length ?? 0;

  // Parallel GitHub queries
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };

  const [commitsRes, prsRes, reviewsRes, openSourceRes, issuesRes] =
    await Promise.allSettled([
      fetch(
        `${GITHUB_API}/search/commits?q=author:${githubLogin}+author-date:>=${sinceStr}&per_page=1`,
        { headers, cache: "no-store" }
      ),
      fetch(
        `${GITHUB_API}/search/issues?q=author:${githubLogin}+type:pr+is:merged&per_page=1`,
        { headers, cache: "no-store" }
      ),
      fetch(
        `${GITHUB_API}/search/issues?q=reviewed-by:${githubLogin}+type:pr&per_page=1`,
        { headers, cache: "no-store" }
      ),
      fetch(
        `${GITHUB_API}/search/issues?q=author:${githubLogin}+type:pr+is:merged+-user:${githubLogin}&per_page=1`,
        { headers, cache: "no-store" }
      ),
      fetch(
        `${GITHUB_API}/search/issues?q=assignee:${githubLogin}+type:issue+state:closed&per_page=1`,
        { headers, cache: "no-store" }
      ),
    ]);

  const getCount = async (
    result: PromiseSettledResult<Response>
  ): Promise<number> => {
    if (result.status !== "fulfilled" || !result.value.ok) return 0;
    const data = (await result.value.json()) as { total_count?: number };
    return data.total_count ?? 0;
  };

  const [totalCommits, totalPrs, totalReviews, openSourcePrs, issuesClosed] =
    await Promise.all([
      getCount(commitsRes),
      getCount(prsRes),
      getCount(reviewsRes),
      getCount(openSourceRes),
      getCount(issuesRes),
    ]);

  return {
    currentStreak: freezeCount, // approximation; real streak from /api/metrics/streak
    longestStreak,
    totalCommits,
    totalPrs,
    totalReviews,
    openSourcePrs,
    issuesClosed,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();
  if (!accessToken || !session?.githubId || !session?.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session?.githubId, session?.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const bypass = isMetricsCacheBypassed(req);
  const key = metricsCacheKey(user.id, "devtrack-badges" as any, {});

  const badges = await withMetricsCache(
    { bypass, key, ttlSeconds: 60 * 60 },
    async () => {
      const stats = await fetchUserStats(
        user.id,
        session?.githubLogin!,
        accessToken!
      );

      // Fetch previously-earned badge timestamps from DB
      const { data: earnedRows } = await supabaseAdmin
        .from("devtrack_badges")
        .select("badge_id, earned_at")
        .eq("user_id", user.id);

      const earnedMap = new Map<string, string>(
        (earnedRows ?? []).map((r: { badge_id: string; earned_at: string }) => [
          r.badge_id,
          r.earned_at,
        ])
      );

      const now = new Date().toISOString();
      const results: DevTrackBadge[] = [];
      const newlyEarned: string[] = [];

      for (const def of BADGE_DEFINITIONS) {
        const earned = def.check(stats);
        if (earned && !earnedMap.has(def.id)) {
          newlyEarned.push(def.id);
          earnedMap.set(def.id, now);
        }
        results.push({
          id: def.id,
          title: def.title,
          description: def.description,
          emoji: def.emoji,
          earned,
          earnedAt: earned ? (earnedMap.get(def.id) ?? now) : null,
        });
      }

      // Persist newly earned badges
      if (newlyEarned.length > 0) {
        await supabaseAdmin.from("devtrack_badges").upsert(
          newlyEarned.map((badge_id) => ({
            user_id: user.id,
            badge_id,
            earned_at: now,
          })),
          { onConflict: "user_id,badge_id" }
        );
      }

      return results;
    }
  );

  return Response.json({ badges });
}