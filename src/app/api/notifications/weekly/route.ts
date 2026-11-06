import { getWeeklyWebhookStats } from "@/lib/weekly-webhook-stats";
import { claimCronBatch } from "@/lib/cron-batch";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { supabaseAdmin } from "@/lib/supabase";
import { validateCronRequest } from "@/lib/cron-auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { safeWebhookFetch } from "@/lib/safe-webhook-fetch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Recipient = {
  id: string;
  github_login: string;
  webhook_url: string | null;
  last_weekly_webhook_at?: string | null;
};
async function dispatch(user: Recipient, token?: string) {
  if (
    user.last_weekly_webhook_at &&
    Date.now() - Date.parse(user.last_weekly_webhook_at) < 7 * 86400000
  )
    return { userId: user.id, sent: false, skipped: true };
  if (!user.webhook_url) return { userId: user.id, sent: false };
  const now = new Date();
  const { data: goals, error: goalsError } = await supabaseAdmin
    .from("goals")
    .select("target,current")
    .eq("user_id", user.id)
    .eq("recurrence", "weekly");
  if (goalsError)
    return { userId: user.id, sent: false, error: "Summary unavailable" };
  let commits: number, prs: number;
  try {
    ({ commits, prs } = await getWeeklyWebhookStats(
      user.id,
      user.github_login,
      token
    ));
  } catch {
    return { userId: user.id, sent: false, error: "Summary unavailable" };
  }
  const percent = goals?.length
    ? Math.round(
        (100 *
          goals.reduce(
            (n, g) =>
              n + (g.target > 0 ? Math.min(1, g.current / g.target) : 0),
            0
          )) /
          goals.length
      )
    : 0;
  try {
    const hostname = new URL(user.webhook_url).hostname;
    const message = `Your weekly DevTrack summary: ${commits} commits, ${prs} PRs merged, ${percent}% goals hit`;
    const discord = hostname === "discord.com" || hostname === "discordapp.com";
    const response = await safeWebhookFetch(user.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discord ? { content: message } : { text: message }),
    });
    if (response.ok) {
      const { error } = await supabaseAdmin
        .from("users")
        .update({ last_weekly_webhook_at: now.toISOString() })
        .eq("id", user.id);
      if (error)
        return {
          userId: user.id,
          sent: true,
          error: "Delivery confirmation could not be saved",
        };
    }
    return {
      userId: user.id,
      sent: response.ok,
      ...(response.ok ? {} : { error: "Delivery failed" }),
    };
  } catch {
    return { userId: user.id, sent: false, error: "Delivery failed" };
  }
}

export async function GET(req: NextRequest) {
  const denied = validateCronRequest(req);
  if (denied) return denied;
  try {
    const batch = await claimCronBatch("weekly-webhooks");
    if (!batch)
      return NextResponse.json({
        skipped: true,
        reason: "Job already running",
      });
    let cursor = batch.cursor;
    const results: Awaited<ReturnType<typeof dispatch>>[] = [];
    const started = Date.now();
    try {
      let hasMore = true;
      while (Date.now() - started < 240_000 && hasMore) {
        let query = supabaseAdmin
          .from("users")
          .select("id,github_login,webhook_url,last_weekly_webhook_at")
          .not("webhook_url", "is", null)
          .order("id")
          .limit(100);
        if (cursor) query = query.gt("id", cursor);
        const { data, error } = await query;
        if (error) throw new Error("Recipients unavailable");
        let visited = 0;
        for (const user of data ?? []) {
          if (Date.now() - started > 240_000) break;
          const result = await dispatch(user);
          if (!("skipped" in result)) results.push(result);
          cursor = user.id;
          visited++;
        }
        hasMore = (data?.length ?? 0) === 100 || visited < (data?.length ?? 0);
        if (!hasMore) cursor = null;
      }
      return NextResponse.json({ results, hasMore });
    } finally {
      await batch.finish(cursor);
    }
  } catch {
    return NextResponse.json(
      { error: "Recipients unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.githubId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  if (body.userId && body.userId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, github_login, webhook_url, last_weekly_webhook_at")
    .eq("id", user.id)
    .single();
  if (error || !data)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({
    results: [await dispatch(data as Recipient, session.accessToken)],
  });
}
