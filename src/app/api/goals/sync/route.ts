import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { extractValidRepoFromGoal, type ActivityGoal } from "@/lib/goals-sync-utils";

export const dynamic = "force-dynamic";

/**
 * Returns Monday 00:00:00 UTC of the current week as a full ISO string.
 * Sunday correctly resolves to the *previous* Monday.
 */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

/** Returns Sunday 23:59:59.999 UTC of the current week as a full ISO string. */
function currentWeekEnd(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() + diff);
  sunday.setUTCHours(23, 59, 59, 999);
  return sunday.toISOString();
}

const GITHUB_API = "https://api.github.com";



export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Fetch user from DB ─────────────────────────────────────────────────
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const weekStart = currentWeekStart();
  const weekEnd = currentWeekEnd();

  // ── 2. Fetch all auto-sync-eligible goals for this week ───────────────────
  const AUTO_SYNC_UNITS = ["commits", "prs", "reviews", "issues_closed", "issues_opened", "open_source_prs"];

  const { data: activityGoals, error: goalsError } = await supabaseAdmin
    .from("goals")
    .select("id, unit, repo, repository, repo_name")
    .eq("user_id", user.id)
    .in("unit", AUTO_SYNC_UNITS)
    .gte("period_start", weekStart)
    .lte("period_start", weekEnd);

  if (goalsError) {
    return Response.json({ error: "Failed to fetch goals" }, { status: 500 });
  }

  if (!activityGoals || activityGoals.length === 0) {
    return Response.json({ updated: 0, commitCount: 0 });
  }

  // ── 3. Sync each goal separately with paginated commit counting ───────────
  const now = new Date().toISOString();

  const commitGoals = activityGoals.filter(g => g.unit === "commits");
  const prGoalsToUpdate = activityGoals.filter(g => g.unit === "prs");
  const reviewGoals = activityGoals.filter(g => g.unit === "reviews");
  const issuesClosedGoals = activityGoals.filter(g => g.unit === "issues_closed");
  const issuesOpenedGoals = activityGoals.filter(g => g.unit === "issues_opened");
  const openSourcePrGoals = activityGoals.filter(g => g.unit === "open_source_prs");

  let totalUpdated = 0;

  for (const goal of commitGoals) {
    let page = 1;
    let commitCount = 0;
    let hasMore = true;

    // Validate the optional repository filter before using it in a query.
    // Any value that is not a strict "owner/repo" identifier is treated as
    // absent so it cannot inject additional search qualifiers.
    const repo = extractValidRepoFromGoal(goal);

    while (hasMore) {
      // Build the GitHub Search query using URLSearchParams so that the
      // combined qualifier string is URL-encoded as a single atomic value
      // and cannot be split by embedded special characters.
      const qParts = [`author:${session.githubLogin}`];
      if (repo) qParts.push(`repo:${repo}`);
      qParts.push(`author-date:${weekStart}..${weekEnd}`);

      const commitSearchParams = new URLSearchParams({
        q: qParts.join(" "),
        per_page: "100",
        page: String(page),
      });

      const ghRes = await fetch(
        `${GITHUB_API}/search/commits?${commitSearchParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: "application/vnd.github+json",
          },
          cache: "no-store",
        }
      );

      if (ghRes.status === 403 || ghRes.status === 429) {
        const resetHeader = ghRes.headers.get("X-RateLimit-Reset");
        const resetAt = resetHeader
          ? new Date(Number(resetHeader) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : null;
        const message = resetAt
          ? `GitHub rate limit reached. Sync will resume at ${resetAt}.`
          : "GitHub rate limit reached. Please try again in a few minutes.";
        return Response.json({ error: message, rateLimited: true }, { status: 429 });
      }

      if (!ghRes.ok) {
        return Response.json({ error: "GitHub API error" }, { status: 502 });
      }

      const ghData = (await ghRes.json()) as {
        items?: unknown[];
      };

      const items = ghData.items || [];

      commitCount += items.length;

      if (items.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("goals")
      .update({
        current: commitCount,
        last_synced_at: now,
      })
      .eq("id", goal.id);

    if (updateError) {
      return Response.json(
        { error: "Failed to update goals" },
        { status: 500 }
      );
    }

    totalUpdated++;
  }

  // Count PRs for the current week
  if (prGoalsToUpdate.length > 0) {
    const prSearchParams = new URLSearchParams({
      q: `author:${session.githubLogin} type:pr is:merged merged:${weekStart}..${weekEnd}`,
      per_page: "100",
    });

    const prRes = await fetch(
      `${GITHUB_API}/search/issues?${prSearchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      }
    );

    if (prRes.ok) {
      const prData = await prRes.json() as { total_count: number };
      const prCount = prData.total_count || 0;
      const prIds = prGoalsToUpdate.map(g => g.id);

      const { error: prUpdateError } = await supabaseAdmin
        .from("goals")
        .update({ current: prCount, last_synced_at: now })
        .in("id", prIds);

      if (prUpdateError) {
        return Response.json({ error: "Failed to update PR goals" }, { status: 500 });
      }

      totalUpdated += prIds.length;
    } else if (prRes.status === 403 || prRes.status === 429) {
      const resetHeader = prRes.headers.get("X-RateLimit-Reset");
      const resetAt = resetHeader
        ? new Date(Number(resetHeader) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : null;
      const message = resetAt
        ? `GitHub rate limit reached. Sync will resume at ${resetAt}.`
        : "GitHub rate limit reached. Please try again in a few minutes.";
      return Response.json({ error: message, rateLimited: true }, { status: 429 });
    } else {
      return Response.json({ error: "GitHub API error fetching PRs" }, { status: 502 });
    }
  }

  // ── Reviews sync ──────────────────────────────────────────────────────────
  if (reviewGoals.length > 0) {
    const reviewRes = await fetch(
      `${GITHUB_API}/search/issues?q=reviewed-by:${session.githubLogin}+type:pr+updated:${weekStart}..${weekEnd}&per_page=1`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );
    if (reviewRes.ok) {
      const reviewData = await reviewRes.json() as { total_count: number };
      await supabaseAdmin.from("goals").update({ current: reviewData.total_count || 0, last_synced_at: now }).in("id", reviewGoals.map(g => g.id));
      totalUpdated += reviewGoals.length;
    }
  }

  // ── Issues closed sync ────────────────────────────────────────────────────
  if (issuesClosedGoals.length > 0) {
    const icRes = await fetch(
      `${GITHUB_API}/search/issues?q=assignee:${session.githubLogin}+type:issue+state:closed+closed:${weekStart}..${weekEnd}&per_page=1`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );
    if (icRes.ok) {
      const icData = await icRes.json() as { total_count: number };
      await supabaseAdmin.from("goals").update({ current: icData.total_count || 0, last_synced_at: now }).in("id", issuesClosedGoals.map(g => g.id));
      totalUpdated += issuesClosedGoals.length;
    }
  }

  // ── Issues opened sync ────────────────────────────────────────────────────
  if (issuesOpenedGoals.length > 0) {
    const ioRes = await fetch(
      `${GITHUB_API}/search/issues?q=author:${session.githubLogin}+type:issue+created:${weekStart}..${weekEnd}&per_page=1`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );
    if (ioRes.ok) {
      const ioData = await ioRes.json() as { total_count: number };
      await supabaseAdmin.from("goals").update({ current: ioData.total_count || 0, last_synced_at: now }).in("id", issuesOpenedGoals.map(g => g.id));
      totalUpdated += issuesOpenedGoals.length;
    }
  }

  // ── Open source PRs sync (PRs to repos the user doesn't own) ─────────────
  if (openSourcePrGoals.length > 0) {
    const osRes = await fetch(
      `${GITHUB_API}/search/issues?q=author:${session.githubLogin}+type:pr+is:merged+merged:${weekStart}..${weekEnd}+-user:${session.githubLogin}&per_page=1`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      }
    );
    if (osRes.ok) {
      const osData = await osRes.json() as { total_count: number };
      await supabaseAdmin.from("goals").update({ current: osData.total_count || 0, last_synced_at: now }).in("id", openSourcePrGoals.map(g => g.id));
      totalUpdated += openSourcePrGoals.length;
    }
  }

  return Response.json({ updated: totalUpdated });
}
