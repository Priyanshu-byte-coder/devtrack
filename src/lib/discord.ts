const DISCORD_WEBHOOK_REGEX =
  /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const MAX_RETRIES = 1;

function validateWebhookUrl(webhookUrl: string) {
  if (!DISCORD_WEBHOOK_REGEX.test(webhookUrl)) {
    throw new Error("Invalid Discord webhook URL");
  }
}

/**
 * Sends a generic JSON payload to a Discord webhook, handling rate limits automatically.
 * @param webhookUrl - The Discord webhook URL.
 * @param payload - The JSON payload to send.
 * @param retryCount - The current retry iteration (internal use).
 * @returns A promise that resolves to true if successful.
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: any,
  retryCount = 0
) {
  validateWebhookUrl(webhookUrl);
  // lgtm[js/request-forgery] - URL is validated by validateWebhookUrl() against a strict Discord-only regex
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Handle Discord rate limiting
  if (res.status === 429) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error("Discord webhook rate limit exceeded");
    }
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return sendDiscordWebhook(webhookUrl, payload, retryCount + 1);
  }
  if (!res.ok) {
    throw new Error(`Discord Webhook failed: ${res.status} ${res.statusText}`);
  }
  return true;
}

/**
 * Sends a test notification to verify a newly linked Discord webhook.
 * @param webhookUrl - The Discord webhook URL.
 * @param username - The GitHub username of the user.
 * @returns A promise resolving to true on success.
 */
export async function sendTestNotification(
  webhookUrl: string,
  username: string
) {
  const payload = {
    username: "DevTrack Bot",
    avatar_url: "https://github.com/Priyanshu-byte-coder.png", // Or a devtrack logo
    embeds: [
      {
        title: "✅ Discord Integration Successful!",
        description: `Hello **${username}**, your Discord webhook has been successfully linked to DevTrack. You will now receive streak reminders and milestone alerts here.`,
        color: 3900150, // Blue
        footer: {
          text: "DevTrack Notifications",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhook(webhookUrl, payload);
}

/**
 * Sends a warning notification to a user whose current commit streak is at risk of expiring.
 * @param webhookUrl - The Discord webhook URL.
 * @param username - The GitHub username.
 * @param currentStreak - The user's current streak length.
 * @returns A promise resolving to true on success.
 */
export async function sendStreakAtRisk(
  webhookUrl: string,
  username: string,
  currentStreak: number
) {
  const payload = {
    username: "DevTrack Bot",
    embeds: [
      {
        title: "⚠️ Streak at Risk!",
        description: `Hey **${username}**, you haven't made any commits today! Your current streak is **${currentStreak} days**. Commit now before midnight to keep it alive!`,
        color: 16750848, // Orange
        footer: {
          text: "DevTrack Streak Reminder",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhook(webhookUrl, payload);
}

/**
 * Sends a celebratory notification when a user reaches a significant streak milestone.
 * @param webhookUrl - The Discord webhook URL.
 * @param username - The GitHub username.
 * @param streak - The milestone streak length reached.
 * @returns A promise resolving to true on success.
 */
export async function sendMilestoneReached(
  webhookUrl: string,
  username: string,
  streak: number
) {
  const payload = {
    username: "DevTrack Bot",
    embeds: [
      {
        title: "🎉 Milestone Reached!",
        description: `Incredible work, **${username}**! You've just hit a **${streak}-day** commit streak! Keep up the amazing consistency! 🚀`,
        color: 16761095, // Gold
        thumbnail: {
          url: "https://github.githubassets.com/images/modules/profile/achievements/pull-shark-default.png", // Just a placeholder fun image
        },
        footer: {
          text: "DevTrack Milestone",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhook(webhookUrl, payload);
}

/**
 * Sends a weekly summary of the user's coding activity to their Discord webhook.
 * @param webhookUrl - The Discord webhook URL.
 * @param username - The GitHub username.
 * @param stats - An object containing the weekly commit, PR, and active days counts.
 * @returns A promise resolving to true on success.
 */
export async function sendWeeklySummary(
  webhookUrl: string,
  username: string,
  stats: { commits: number; prs: number; activeDays: number }
) {
  const payload = {
    username: "DevTrack Bot",
    embeds: [
      {
        title: "📊 Weekly Summary",
        description: `Here is your coding activity summary for the past week, **${username}**:`,
        color: 5814783, // Purple-ish
        fields: [
          {
            name: "Commits",
            value: `${stats.commits}`,
            inline: true,
          },
          {
            name: "Pull Requests",
            value: `${stats.prs}`,
            inline: true,
          },
          {
            name: "Active Days",
            value: `${stats.activeDays} / 7`,
            inline: true,
          },
        ],
        footer: {
          text: "DevTrack Weekly Summary",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  return sendDiscordWebhook(webhookUrl, payload);
}
