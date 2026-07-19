import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { encryptToken } from "@/lib/crypto";
import { validateTextInput } from "@/lib/sanitize";
import { clearLeaderboardCache } from "@/lib/leaderboard";
import { cacheGet, cacheSet, cacheDelete } from "@/lib/metrics-cache";
import {
  defaultLocale,
  isValidLocale,
  localeCookieMaxAge,
  localeCookieName,
} from "@/i18n/config";
import { logError } from "@/lib/error-handler";
export const dynamic = "force-dynamic";

function settingsResponse(body: Record<string, any>, status = 200) {
  const response = NextResponse.json(body, { status });
  const preferredLocale =
    typeof body.preferred_locale === "string" && isValidLocale(body.preferred_locale)
      ? body.preferred_locale
      : defaultLocale;

  response.cookies.set(localeCookieName, preferredLocale, {
    maxAge: localeCookieMaxAge,
    path: "/",
    sameSite: "lax",
  });

  return response;
}

const VALID_WIDGETS = ["streak", "contributions", "languages", "prs"] as const;
type WidgetKey = (typeof VALID_WIDGETS)[number];

function sanitizePublicWidgets(input: unknown): WidgetKey[] {
  if (!Array.isArray(input)) return ["streak", "contributions"];
  return input.filter((w): w is WidgetKey =>
    typeof w === "string" && (VALID_WIDGETS as readonly string[]).includes(w)
  );
}

async function fetchUserSettings(userId: string) {
  const res1 = await supabaseAdmin
    .from("users")
    .select("id, github_login, bio, is_public, public_since, show_weekly_goals, leaderboard_opt_in, pinned_repos, wakatime_api_key_encrypted, wakatime_api_key_iv, weekly_digest_opt_in, discord_webhook_url, timezone, webhook_url, discord_muted_until, public_widgets, preferred_locale")
    .eq("id", userId)
    .single();

  if (!res1.error) {
    return {
      data: res1.data as any,
      error: null,
      hasLeaderboardOptIn: true,
      hasPinnedRepos: true,
      hasWakatimeKey: true,
      hasWeeklyDigestOptIn: true,
      hasDiscordSettings: true,
      hasBio: true,
      hasWebhookUrl: true,
      hasDiscordMutedUntil: true,
      hasPublicWidgets: true,
      hasPreferredLocale: true,
      leaderboard_opt_in: (res1.data as any).leaderboard_opt_in ?? false,
      weekly_digest_opt_in: (res1.data as any).weekly_digest_opt_in ?? false,
      pinned_repos: (res1.data as any).pinned_repos || [],
      wakatime_api_key_encrypted: (res1.data as any).wakatime_api_key_encrypted || null,
      wakatime_api_key_iv: (res1.data as any).wakatime_api_key_iv || null,
      discord_webhook_url: (res1.data as any).discord_webhook_url || null,
      timezone: (res1.data as any).timezone || "UTC",
      webhook_url: (res1.data as any).webhook_url || null,
      discord_muted_until: (res1.data as any).discord_muted_until || null,
      public_widgets: sanitizePublicWidgets((res1.data as any).public_widgets),
      preferred_locale: (res1.data as any).preferred_locale || defaultLocale,
    };
  }

  const res2 = await supabaseAdmin
    .from("users")
    .select("id, github_login, bio, is_public, public_since, show_weekly_goals, leaderboard_opt_in, pinned_repos, wakatime_api_key_encrypted, wakatime_api_key_iv, weekly_digest_opt_in, discord_webhook_url, timezone, webhook_url, discord_muted_until, preferred_locale")
    .eq("id", userId)
    .single();

  if (!res2.error) {
    return {
      data: res2.data as any,
      error: null,
      hasLeaderboardOptIn: true,
      hasPinnedRepos: true,
      hasWakatimeKey: true,
      hasWeeklyDigestOptIn: true,
      hasDiscordSettings: true,
      hasBio: true,
      hasWebhookUrl: true,
      hasDiscordMutedUntil: true,
      hasPublicWidgets: false,
      hasPreferredLocale: true,
      leaderboard_opt_in: (res2.data as any).leaderboard_opt_in ?? false,
      weekly_digest_opt_in: (res2.data as any).weekly_digest_opt_in ?? false,
      pinned_repos: (res2.data as any).pinned_repos || [],
      wakatime_api_key_encrypted: (res2.data as any).wakatime_api_key_encrypted || null,
      wakatime_api_key_iv: (res2.data as any).wakatime_api_key_iv || null,
      discord_webhook_url: (res2.data as any).discord_webhook_url || null,
      timezone: (res2.data as any).timezone || "UTC",
      webhook_url: (res2.data as any).webhook_url || null,
      discord_muted_until: (res2.data as any).discord_muted_until || null,
      public_widgets: ["streak", "contributions"] as WidgetKey[],
      preferred_locale: (res2.data as any).preferred_locale || defaultLocale,
    };
  }

  const res3 = await supabaseAdmin
    .from("users")
    .select("id, github_login, is_public, public_since, show_weekly_goals, leaderboard_opt_in, pinned_repos, wakatime_api_key_encrypted, wakatime_api_key_iv, webhook_url")
    .eq("id", userId)
    .single();

  if (!res3.error) {
    return {
      data: res3.data as any,
      error: null,
      hasLeaderboardOptIn: true,
      hasPinnedRepos: true,
      hasWakatimeKey: true,
      hasWeeklyDigestOptIn: false,
      hasDiscordSettings: false,
      hasBio: false,
      hasWebhookUrl: true,
      hasDiscordMutedUntil: false,
      hasPublicWidgets: false,
      hasPreferredLocale: false,
      leaderboard_opt_in: (res3.data as any).leaderboard_opt_in ?? false,
      weekly_digest_opt_in: false,
      pinned_repos: (res3.data as any).pinned_repos || [],
      wakatime_api_key_encrypted: (res3.data as any).wakatime_api_key_encrypted || null,
      wakatime_api_key_iv: (res3.data as any).wakatime_api_key_iv || null,
      discord_webhook_url: null,
      timezone: "UTC",
      webhook_url: (res3.data as any).webhook_url || null,
      discord_muted_until: null,
      public_widgets: ["streak", "contributions"] as WidgetKey[],
      preferred_locale: defaultLocale,
    };
  }

  return {
    data: { id: userId, github_login: "" },
    error: null,
    hasLeaderboardOptIn: false,
    hasPinnedRepos: false,
    hasWakatimeKey: false,
    hasWeeklyDigestOptIn: false,
    hasDiscordSettings: false,
    hasBio: false,
    hasWebhookUrl: false,
    hasDiscordMutedUntil: false,
    hasPublicWidgets: false,
    hasPreferredLocale: false,
    leaderboard_opt_in: false,
    weekly_digest_opt_in: false,
    pinned_repos: [] as string[],
    wakatime_api_key_encrypted: null,
    wakatime_api_key_iv: null,
    discord_webhook_url: null,
    timezone: "UTC",
    webhook_url: null,
    discord_muted_until: null,
    public_widgets: ["streak", "contributions"] as WidgetKey[],
    preferred_locale: defaultLocale,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "Failed to fetch user settings" }, { status: 500 });
  }

  const cacheKey = `settings:${user.id}`;
  const SETTINGS_TTL = 5 * 60;

  const cached = await cacheGet<Record<string, unknown>>(cacheKey, SETTINGS_TTL);
  if (cached) {
    return settingsResponse(cached);
  }

  const result = await fetchUserSettings(user.id);

  const responseData = {
    id: user.id,
    github_login: session.githubLogin || "",
    bio: result.data?.bio ?? "",
    is_public: result.data?.is_public ?? false,
    public_since: result.data?.public_since ?? null,
    show_weekly_goals: result.data?.show_weekly_goals ?? false,
    leaderboard_opt_in: result.leaderboard_opt_in,
    weekly_digest_opt_in: result.weekly_digest_opt_in,
    pinned_repos: result.pinned_repos,
    has_wakatime_key: !!result.wakatime_api_key_encrypted && !!result.wakatime_api_key_iv,
    discord_webhook_url: result.discord_webhook_url,
    timezone: result.timezone,
    webhook_url: result.webhook_url ?? null,
    discord_muted_until: result.discord_muted_until ?? null,
    public_widgets: result.public_widgets,
    preferred_locale: result.preferred_locale,
  };

  await cacheSet(cacheKey, responseData, SETTINGS_TTL);
  return settingsResponse(responseData);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { is_public, show_weekly_goals, leaderboard_opt_in, weekly_digest_opt_in, pinned_repos, wakatime_api_key, discord_webhook_url, timezone, bio, webhook_url, discord_muted_until, public_widgets, seen_onboarding, preferred_locale } = body;

  const settingsResult = await fetchUserSettings(user.id);
  const { hasLeaderboardOptIn, hasPinnedRepos, hasWakatimeKey, hasWeeklyDigestOptIn, hasDiscordSettings, hasBio, hasWebhookUrl, hasDiscordMutedUntil, hasPublicWidgets, hasPreferredLocale } = settingsResult;
  const updates: any = {};

  if (is_public !== undefined && is_public !== null && typeof is_public === "boolean") {
    updates.is_public = is_public;
    updates.public_since = is_public ? new Date().toISOString() : null;
  }

  if (hasLeaderboardOptIn && leaderboard_opt_in !== undefined && leaderboard_opt_in !== null && typeof leaderboard_opt_in === "boolean") {
    updates.leaderboard_opt_in = leaderboard_opt_in;
    if (leaderboard_opt_in) updates.is_public = true;
  }

  if (show_weekly_goals !== undefined && show_weekly_goals !== null && typeof show_weekly_goals === "boolean") {
    updates.show_weekly_goals = show_weekly_goals;
  }

  if (hasWebhookUrl && (typeof webhook_url === "string" || webhook_url === null)) {
    updates.webhook_url = webhook_url;
  }

  if (hasWeeklyDigestOptIn && weekly_digest_opt_in !== undefined && weekly_digest_opt_in !== null && typeof weekly_digest_opt_in === "boolean") {
    updates.weekly_digest_opt_in = weekly_digest_opt_in;
  }

  if (hasPinnedRepos && pinned_repos !== undefined && pinned_repos !== null && Array.isArray(pinned_repos)) {
    if (pinned_repos.length > 3) return NextResponse.json({ error: "Maximum 3 pins allowed" }, { status: 400 });
    updates.pinned_repos = pinned_repos;
  }

  if (typeof seen_onboarding === "boolean") updates.seen_onboarding = seen_onboarding;

  if (hasBio && bio !== undefined) {
    const result = validateTextInput(bio, "Bio", 500);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    updates.bio = result.value;
  }

  if (hasWakatimeKey && wakatime_api_key !== undefined) {
    if (wakatime_api_key === "") {
      updates.wakatime_api_key_encrypted = null;
      updates.wakatime_api_key_iv = null;
    } else if (typeof wakatime_api_key === "string") {
      try {
        const { encrypted, iv } = encryptToken(wakatime_api_key);
        updates.wakatime_api_key_encrypted = encrypted;
        updates.wakatime_api_key_iv = iv;
      } catch (err) {
        return NextResponse.json({ error: "Failed to encrypt Wakatime key" }, { status: 500 });
      }
    }
  }

  if (hasDiscordSettings && discord_webhook_url !== undefined) {
    updates.discord_webhook_url = discord_webhook_url || null;
  }

  if (hasDiscordSettings && timezone !== undefined && typeof timezone === "string") {
    updates.timezone = timezone;
  }

  if (hasDiscordMutedUntil && discord_muted_until !== undefined) {
    updates.discord_muted_until = discord_muted_until;
  }

  if (hasPublicWidgets && public_widgets !== undefined && Array.isArray(public_widgets)) {
    updates.public_widgets = sanitizePublicWidgets(public_widgets);
  }

  if (hasPreferredLocale && preferred_locale !== undefined) {
    updates.preferred_locale = preferred_locale;
  }

  await supabaseAdmin.from("users").update(updates).eq("id", user.id);

  return settingsResponse({
    id: user.id,
    github_login: session.githubLogin || "",
    bio: updates.bio ?? settingsResult.data?.bio ?? "",
    is_public: updates.is_public ?? settingsResult.data?.is_public ?? false,
    public_since: updates.public_since ?? settingsResult.data?.public_since ?? null,
    show_weekly_goals: updates.show_weekly_goals ?? settingsResult.data?.show_weekly_goals ?? false,
    leaderboard_opt_in: updates.leaderboard_opt_in ?? settingsResult.leaderboard_opt_in,
    weekly_digest_opt_in: updates.weekly_digest_opt_in ?? settingsResult.weekly_digest_opt_in,
    pinned_repos: updates.pinned_repos ?? settingsResult.pinned_repos,
    has_wakatime_key: !!settingsResult.wakatime_api_key_encrypted,
    discord_webhook_url: updates.discord_webhook_url ?? settingsResult.discord_webhook_url,
    timezone: updates.timezone ?? settingsResult.timezone,
    webhook_url: updates.webhook_url ?? settingsResult.webhook_url,
    discord_muted_until: updates.discord_muted_until ?? settingsResult.discord_muted_until,
    public_widgets: updates.public_widgets ?? settingsResult.public_widgets,
    preferred_locale: updates.preferred_locale ?? settingsResult.preferred_locale,
  });
}
