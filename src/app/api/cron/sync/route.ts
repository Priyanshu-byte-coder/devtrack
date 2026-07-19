import { NextResponse } from 'next/server';
import { supabaseAdmin } from "@/lib/supabase";
import { decryptTokenEdge } from "@/lib/crypto-edge";
import { syncGitHubAchievementsForUser } from "@/lib/github-achievements";
import { logError } from "@/lib/error-handler";

export const runtime = 'edge';

export async function POST(req: Request) {
  // Verify authorization
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let wakaSuccess = 0;
    let wakaFailure = 0;
    let githubSuccess = 0;
    let githubFailure = 0;

    const PAGE_SIZE = 50;
    const CHUNK_SIZE = 5;

    // 1. Sync WakaTime (Paginated)
    let wakaPage = 0;
    let wakaHasMore = true;

    while (wakaHasMore) {
      const { data: wakaUsers, error: wakaUsersError } = await supabaseAdmin
        .from("users")
        .select("id, wakatime_api_key_encrypted, wakatime_api_key_iv")
        .not("wakatime_api_key_encrypted", "is", null)
        .not("wakatime_api_key_iv", "is", null)
        .order("id")
        .range(wakaPage * PAGE_SIZE, (wakaPage + 1) * PAGE_SIZE - 1);

      if (wakaUsersError) {
        logError(new Error(wakaUsersError.message), { endpoint: "/api/cron/sync", operation: "fetchWakatimeUsers" });
        break;
      }

      if (!wakaUsers || wakaUsers.length === 0) {
        wakaHasMore = false;
        break;
      }

      for (let i = 0; i < wakaUsers.length; i += CHUNK_SIZE) {
        const chunk = wakaUsers.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(chunk.map(async (user) => {
          try {
            const apiKey = await decryptTokenEdge(
              user.wakatime_api_key_encrypted!,
              user.wakatime_api_key_iv!
            );

            if (!apiKey) {
              logError(new Error("Decryption failed"), { endpoint: "/api/cron/sync", operation: "decryptWakatimeToken", userId: user.id });
              return false;
            }

            const res = await fetch("https://wakatime.com/api/v1/users/current/summaries?range=Last%207%20Days", {
              headers: {
                Authorization: `Basic ${btoa(apiKey + ":")}`,
              },
              cache: "no-store"
            });

            if (!res.ok) {
              logError(new Error(`Wakatime API error: ${res.status}`), { endpoint: "/api/cron/sync", operation: "fetchWakatimeSummary", userId: user.id, additionalContext: { status: res.status } });
              return false;
            }

            const data = await res.json();
            if (!data || !data.data) {
              return false;
            }

            const now = new Date().toISOString();
            const statsToUpsert = data.data.map((day: any) => ({
              user_id: user.id,
              date: day.range.date,
              total_seconds: Math.round(day.grand_total.total_seconds),
              languages: day.languages.map((l: any) => ({ name: l.name, total_seconds: l.total_seconds, percent: l.percent })),
              projects: day.projects.map((p: any) => ({ name: p.name, total_seconds: p.total_seconds, percent: p.percent })),
              updated_at: now
            }));

            const { error: upsertError } = await supabaseAdmin
              .from("wakatime_stats")
              .upsert(statsToUpsert, { onConflict: "user_id, date" });

            if (upsertError) {
              logError(new Error(upsertError.message), { endpoint: "/api/cron/sync", operation: "upsertWakatimeStats", userId: user.id });
              return false;
            }

            return true;
          } catch (e) {
            logError(e, { endpoint: "/api/cron/sync", operation: "syncWakatimeStats", userId: user.id });
            return false;
          }
        }));

        for (const res of results) {
          if (res.status === "fulfilled" && res.value === true) {
            wakaSuccess++;
          } else {
            wakaFailure++;
          }
        }
      }

      if (wakaUsers.length < PAGE_SIZE) {
        wakaHasMore = false;
      } else {
        wakaPage++;
      }
    }

    // 2. Sync GitHub Achievements (Paginated)
    let ghPage = 0;
    let ghHasMore = true;

    while (ghHasMore) {
      const { data: ghAccounts, error: ghAccountsError } = await supabaseAdmin
        .from("user_github_accounts")
        .select("user_id, github_login, access_token_encrypted, access_token_iv")
        .order("user_id")
        .range(ghPage * PAGE_SIZE, (ghPage + 1) * PAGE_SIZE - 1);

      if (ghAccountsError) {
        logError(new Error(ghAccountsError.message), { endpoint: "/api/cron/sync", operation: "fetchGithubAccounts" });
        break;
      }

      if (!ghAccounts || ghAccounts.length === 0) {
        ghHasMore = false;
        break;
      }

      for (let i = 0; i < ghAccounts.length; i += CHUNK_SIZE) {
        const chunk = ghAccounts.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(chunk.map(async (account) => {
          try {
            const token = await decryptTokenEdge(
              account.access_token_encrypted,
              account.access_token_iv
            );

            if (!token) {
              logError(new Error("Decryption failed"), { endpoint: "/api/cron/sync", operation: "decryptGithubToken", userId: account.user_id });
              return false;
            }

            // Sync achievements (using force: false to prevent rate limit hits unless cached data is stale)
            await syncGitHubAchievementsForUser({
              userId: account.user_id,
              githubLogin: account.github_login,
              token: token,
              force: false
            });

            return true;
          } catch (e) {
            logError(e, { endpoint: "/api/cron/sync", operation: "syncGithubAchievements", userId: account.user_id });
            return false;
          }
        }));

        for (const res of results) {
          if (res.status === "fulfilled" && res.value === true) {
            githubSuccess++;
          } else {
            githubFailure++;
          }
        }
      }

      if (ghAccounts.length < PAGE_SIZE) {
        ghHasMore = false;
      } else {
        ghPage++;
      }
    }

    return NextResponse.json({
      success: true,
      wakatime: { success: wakaSuccess, failure: wakaFailure },
      github: { success: githubSuccess, failure: githubFailure }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logError(error, { endpoint: "/api/cron/sync", operation: "cronSyncFatal" });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
