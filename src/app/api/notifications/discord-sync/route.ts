import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMilestoneReached, sendStreakAtRisk, sendWeeklySummary } from "@/lib/discord";
import { fetchPublicStreak, fetchPublicContributions } from "@/lib/public-profile-data";
import { toDateStr } from "@/lib/date-utils";
import { validateCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

const DISCORD_WEBHOOK_REGEX =
  /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;

function isValidDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_REGEX.test(url);
}

export async function GET(req: Request) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, github_login, discord_webhook_url, timezone, last_discord_notification_at, discord_muted_until")
    .not("discord_webhook_url", "is", null);

  if (error || !users) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const token = process.env.GITHUB_TOKEN;
  const now = new Date();

  let processed = 0;
  let notificationsSent = 0;

  for (const user of users) {
    if (!user.discord_webhook_url) continue;
    if (!isValidDiscordWebhookUrl(user.discord_webhook_url)) continue;

    const tz = user.timezone || "UTC";
    let localHour: number;
    let isSunday = false;

    try {
      const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false, weekday: "short" });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find(p => p.type === "hour")?.value;
      const weekdayPart = parts.find(p => p.type === "weekday")?.value;
      localHour = parseInt(hourPart || "0", 10);

      // Handle "24" meaning midnight in some Intl implementations
      if (localHour === 24) localHour = 0;

      isSunday = weekdayPart === "Sun";
    } catch (e) {
      localHour = now.getUTCHours();
      isSunday = now.getUTCDay() === 0;
    }

    if (localHour !== 20) {
      continue;
    }

    if (user.last_discord_notification_at) {
      const lastNotified = new Date(user.last_discord_notification_at);
      if (now.getTime() - lastNotified.getTime() < 20 * 60 * 60 * 1000) {
        continue;
      }
    }

    if (user.discord_muted_until) {
      const mutedUntil = new Date(user.discord_muted_until);
      if (mutedUntil.getTime() > now.getTime()) {
        continue;
      }
    }

    processed++;

    try {
      const streakData = await fetchPublicStreak(user.github_login, token);
      let sentSomething = false;

      // Determine "today" in the user`s timezone, or UTC if fallback
      let todayStr: string;
      try {
        const dFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
        const [{value: mo},,{value: da},,{value: ye}] = dFmt.formatToParts(now);
        todayStr = `${ye}-${mo}-${da}`;
      } catch (e) {
        todayStr = toDateStr(now);
      }

      if (streakData.lastCommitDate !== todayStr && streakData.current > 0) {
        await sendStreakAtRisk(user.discord_webhook_url, user.github_login, streakData.current);
        sentSomething = true;
      }

      if (streakData.lastCommitDate === todayStr) {
        const milestones = [7, 14, 30, 100];
        if (milestones.includes(streakData.current)) {
          await sendMilestoneReached(user.discord_webhook_url, user.github_login, streakData.current);
          sentSomething = true;
        }
      }

      if (isSunday) {
        const contribData = await fetchPublicContributions(user.github_login, token, 7);
        const stats = {
          commits: contribData.total,
          prs: 0,
          activeDays: Object.keys(contribData.data).length,
        };
        await sendWeeklySummary(user.discord_webhook_url, user.github_login, stats);
        sentSomething = true;
      }

      if (sentSomething) {
        await supabaseAdmin
          .from("users")
          .update({ last_discord_notification_at: now.toISOString() })
          .eq("id", user.id);
        notificationsSent++;
      }
    } catch (err) {
      console.error(`Failed to process discord notifications for user ${user.github_login}`, err);
    }
  }

  return NextResponse.json({ success: true, processed, notificationsSent });
}