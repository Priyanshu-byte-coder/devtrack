import { throwIfGitHubRateLimited } from "@/lib/github-rate-limit";
import "server-only";
import { githubRequest } from "@/lib/github-request";
import { supabaseAdmin } from "@/lib/supabase";
import { extractValidRepoFromGoal } from "@/lib/goals-sync-utils";
export class GoalDatabaseError extends Error {}
const UNITS = [
  "commits",
  "prs",
  "reviews",
  "issues_closed",
  "issues_opened",
  "open_source_prs",
];
export async function syncGoalsForUser(
  userId: string,
  login: string,
  token: string
) {
  const now = new Date();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const end = now.toISOString();
  const { data: goals, error } = await supabaseAdmin
    .from("goals")
    .select("id,unit,repo,period_start,recurrence,created_at")
    .eq("user_id", userId)
    .in("unit", UNITS)
    .limit(100);
  if (error) throw new GoalDatabaseError("Failed to fetch goals");
  if (!goals?.length) return { updated: 0, commitCount: 0 };
  const deadline = AbortSignal.timeout(20_000);
  const counts = new Map<string, number>();
  const updates: { id: string; count: number }[] = [];
  for (const goal of goals) {
    let periodStart =
      goal.recurrence === "weekly"
        ? monday.toISOString()
        : goal.recurrence === "monthly"
          ? new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
            ).toISOString()
          : (goal.period_start ?? monday.toISOString());
    if (
      goal.recurrence === "none" &&
      goal.created_at &&
      goal.created_at > periodStart
    )
      periodStart = goal.created_at;
    // A rollover must be archived by the goal endpoint before changing its progress.
    if (
      goal.recurrence !== "none" &&
      goal.period_start &&
      goal.period_start < periodStart
    )
      continue;
    const repo = extractValidRepoFromGoal(goal);
    const range = `${periodStart}..${end}`;
    const qualifiers: Record<string, string> = {
      commits: `author:${login} author-date:${range}`,
      prs: `author:${login} type:pr is:merged merged:${range}`,
      reviews: `reviewed-by:${login} type:pr updated:${range}`,
      issues_closed: `assignee:${login} type:issue state:closed closed:${range}`,
      issues_opened: `author:${login} type:issue created:${range}`,
      open_source_prs: `author:${login} type:pr is:merged merged:${range} -user:${login}`,
    };
    const query = qualifiers[goal.unit] + (repo ? ` repo:${repo}` : "");
    let count = counts.get(query);
    if (count === undefined) {
      const params = new URLSearchParams({ q: query, per_page: "1" });
      const response = await githubRequest(
        `https://api.github.com/search/${goal.unit === "commits" ? "commits" : "issues"}?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: deadline,
        }
      );
      if (!response.ok) {
        throwIfGitHubRateLimited(response);
        throw new Error("GitHub API error");
      }
      const result = (await response.json()) as {
        total_count?: number;
        incomplete_results?: boolean;
      };
      if (
        result.incomplete_results ||
        !Number.isSafeInteger(result.total_count) ||
        result.total_count! < 0
      ) {
        throw new Error("GitHub returned incomplete goal counts");
      }
      count = result.total_count!;
      counts.set(query, count);
    }
    updates.push({ id: goal.id, count });
  }
  // Validate every upstream count before persisting progress. Errors never become zero.
  for (const update of updates) {
    const { error } = await supabaseAdmin
      .from("goals")
      .update({ current: update.count, last_synced_at: end })
      .eq("id", update.id)
      .eq("user_id", userId);
    if (error) throw new GoalDatabaseError("Failed to update goals");
  }
  return { updated: updates.length };
}
