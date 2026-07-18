import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isDiscordWebhook(url: string) {
  return url.includes("discord") || url.includes("discordapp");
}

async function sendWebhook(url: string, message: string) {
  try {
    const body = isDiscordWebhook(url)
      ? { content: message }
      : { text: message };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Webhook POST failed for ${url}: ${res.status} ${text}`);
      return { ok: false, status: res.status, text };
    }

    return { ok: true };
  } catch (error) {
    console.error(`Error sending webhook to ${url}:`, error);
    return { ok: false, error };
  }
}

export async function GET(req: NextRequest) {
  // Compute time window: last 7 days
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  // Fetch all users with webhook_url set
  const { data: users, error: usersError } = await supabaseAdmin
    .from("users")
    .select("id, github_login, webhook_url")
    .not("webhook_url", "is", null);

  if (usersError) {
    console.error("Failed to fetch users for notifications:", usersError);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const results: Array<{ userId: string; github_login: string; webhook: string; sent: boolean; error?: any; summary?: any }> = [];

  for (const u of users as any[]) {
    const webhook: string | null = u.webhook_url;
    if (!webhook) continue;

    // Aggregate commits and prs_merged from metric_snapshots in the last 7 days
    const { data: snaps, error: snapsError } = await supabaseAdmin
      .from("metric_snapshots")
      .select("commits, prs_merged")
      .eq("user_id", u.id)
      .gte("snapshot_at", weekStart.toISOString())
      .lte("snapshot_at", now.toISOString());

    if (snapsError) {
      console.error(`Failed to fetch snapshots for user ${u.id}:`, snapsError);
      results.push({ userId: u.id, github_login: u.github_login, webhook, sent: false, error: snapsError });
      continue;
    }

    const totalCommits = (snaps as any[]).reduce((s, r) => s + (r.commits ?? 0), 0);
    const totalPrs = (snaps as any[]).reduce((s, r) => s + (r.prs_merged ?? 0), 0);

    // Compute weekly goal completion percentage for weekly goals
    const { data: goals, error: goalsError } = await supabaseAdmin
      .from("goals")
      .select("id, target, current, recurrence")
      .eq("user_id", u.id)
      .eq("recurrence", "weekly");

    if (goalsError) {
      console.error(`Failed to fetch goals for user ${u.id}:`, goalsError);
      results.push({ userId: u.id, github_login: u.github_login, webhook, sent: false, error: goalsError });
      continue;
    }

    let goalsPercent = 0;
    if ((goals as any[]).length > 0) {
      const per = (goals as any[]).map((g) => {
        if (!g.target || g.target === 0) return 0;
        return Math.min(1, g.current / g.target);
      });
      goalsPercent = Math.round((per.reduce((a, b) => a + b, 0) / per.length) * 100);
    }

    const message = `Your weekly DevTrack summary: ${totalCommits} commits, ${totalPrs} PRs merged, ${goalsPercent}% goals hit`;

    const sendResult = await sendWebhook(webhook, message);

    results.push({
      userId: u.id,
      github_login: u.github_login,
      webhook,
      sent: !!sendResult.ok,
      error: sendResult.ok ? undefined : sendResult,
      summary: { commits: totalCommits, prs_merged: totalPrs, goals_percent: goalsPercent },
    });
  }

  return NextResponse.json({ results });
}

export async function POST(req: NextRequest) {
  // Allow manual trigger with optional body { userId?: string }
  try {
    const body = await req.json().catch(() => ({}));
    if (body.userId) {
      // Trigger for single user
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, github_login, webhook_url")
        .eq("id", body.userId)
        .single();

      if (userError || !user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Reuse GET logic by calling GET and filtering
      return GET(req);
    }

    return GET(req);
  } catch (err) {
    console.error("Error in weekly notifications POST:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
