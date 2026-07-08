import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ACHIEVEMENTS } from "@/lib/achievements-config";

export const dynamic = "force-dynamic";

const GITHUB_API = "https://api.github.com";

interface BadgeRow {
  badge_id: string;
  earned_at: string;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // ── 1. Fetch current GitHub stats for the user ─────────────────────────────────
  let totalCommits = 0;
  let totalPRs = 0;
  let totalRepos = 0;
  let longestStreak = 0;

  try {
    // Total commits
    const commitRes = await fetch(`${GITHUB_API}/search/commits?q=author:${session.githubLogin}&per_page=1`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" }
    });
    if (commitRes.ok) {
      const commitData = await commitRes.json();
      totalCommits = commitData.total_count || 0;
    }

    // Total PRs
    const prRes = await fetch(`${GITHUB_API}/search/issues?q=author:${session.githubLogin}+type:pr&per_page=1`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" }
    });
    if (prRes.ok) {
      const prData = await prRes.json();
      totalPRs = prData.total_count || 0;
    }

    // Total Repositories (approximated by user's owned repos or repos contributed to if available, 
    // but searching commits without repo filter already tells us they contributed. 
    // To get exact repo count contributed to, we would need to paginate commits, which is slow.
    // As an approximation, we'll fetch user's public repos + organizations repos).
    // A better proxy: search/repositories?q=user:${session.githubLogin}
    const repoRes = await fetch(`${GITHUB_API}/search/repositories?q=user:${session.githubLogin}&per_page=1`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" }
    });
    if (repoRes.ok) {
      const repoData = await repoRes.json();
      totalRepos = repoData.total_count || 0;
    }

    // Longest Streak
    // Usually calculated in DevTrack by fetching recent activity. We'll use 1-year lookback to find the longest streak.
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    // We can fetch local API or GitHub directly. Using GraphQL to get contributionCalendar is easiest for streak.
    const streakQuery = `
      query($login: String!) {
        user(login: $login) {
          contributionsCollection {
            contributionCalendar {
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
        }
      }
    `;
    const streakRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: streakQuery, variables: { login: session.githubLogin } }),
    });

    if (streakRes.ok) {
      const streakData = await streakRes.json();
      const weeks = streakData.data?.user?.contributionsCollection?.contributionCalendar?.weeks || [];
      let currentRun = 0;
      for (const week of weeks) {
        for (const day of week.contributionDays) {
          if (day.contributionCount > 0) {
            currentRun++;
            longestStreak = Math.max(longestStreak, currentRun);
          } else {
            currentRun = 0;
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch achievement metrics", err);
  }

  const metrics = { commits: totalCommits, pull_requests: totalPRs, repositories: totalRepos, streak: longestStreak };

  // ── 2. Load existing achievements from DB ──────────────────────────────────
  const { data: existingBadges } = await supabaseAdmin
    .from("devtrack_badges")
    .select("badge_id, earned_at")
    .eq("user_id", user.id);

  const unlockedIds = new Set((existingBadges as BadgeRow[] || []).map(b => b.badge_id));
  const newUnlocks: string[] = [];
  const inserts: { user_id: string; badge_id: string }[] = [];

  // ── 3. Evaluate new achievements ───────────────────────────────────────────
  for (const achievement of ACHIEVEMENTS) {
    if (unlockedIds.has(achievement.id)) continue;

    const currentMetric = metrics[achievement.category];
    if (currentMetric >= achievement.requirement) {
      newUnlocks.push(achievement.id);
      inserts.push({ user_id: user.id, badge_id: achievement.id });
      unlockedIds.add(achievement.id); // mark as unlocked
    }
  }

  // ── 4. Save new unlocks ────────────────────────────────────────────────────
  if (inserts.length > 0) {
    await supabaseAdmin.from("devtrack_badges").insert(inserts);
  }

  return Response.json({
    metrics,
    unlockedIds: Array.from(unlockedIds),
    newUnlocks,
    achievements: ACHIEVEMENTS,
  });
}
