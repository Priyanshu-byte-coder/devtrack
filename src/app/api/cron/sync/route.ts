import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { validateCronRequest } from "@/lib/cron-auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptTokenEdge } from "@/lib/crypto-edge";
import { syncGitHubAchievementsForUser } from "@/lib/github-achievements";
import { logError } from "@/lib/error-handler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = validateCronRequest(req);
  if (denied) return denied;

  try {
    let githubSuccess = 0;
    let githubFailure = 0;

    const PAGE_SIZE = 50;
    const CHUNK_SIZE = 5;

    // Sync GitHub Achievements (Paginated)
    let ghPage = 0;
    let ghHasMore = true;

    while (ghHasMore) {
      const { data: ghAccounts, error: ghAccountsError } = await supabaseAdmin
        .from("user_github_accounts")
        .select(
          "user_id, github_login, access_token_encrypted, access_token_iv"
        )
        .order("user_id")
        .range(ghPage * PAGE_SIZE, (ghPage + 1) * PAGE_SIZE - 1);

      if (ghAccountsError) {
        logError(new Error(ghAccountsError.message), {
          endpoint: "/api/cron/sync",
          operation: "fetchGithubAccounts",
        });
        break;
      }

      if (!ghAccounts || ghAccounts.length === 0) {
        ghHasMore = false;
        break;
      }

      for (let i = 0; i < ghAccounts.length; i += CHUNK_SIZE) {
        const chunk = ghAccounts.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map(async (account) => {
            try {
              const token = await decryptTokenEdge(
                account.access_token_encrypted,
                account.access_token_iv
              );

              if (!token) {
                logError(new Error("Decryption failed"), {
                  endpoint: "/api/cron/sync",
                  operation: "decryptGithubToken",
                  userId: account.user_id,
                });
                return false;
              }

              // Sync achievements (using force: false to prevent rate limit hits unless cached data is stale)
              await syncGitHubAchievementsForUser({
                userId: account.user_id,
                githubLogin: account.github_login,
                token: token,
                force: false,
              });

              return true;
            } catch (e) {
              logError(e, {
                endpoint: "/api/cron/sync",
                operation: "syncGithubAchievements",
                userId: account.user_id,
              });
              return false;
            }
          })
        );

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
      github: { success: githubSuccess, failure: githubFailure },
    });
  } catch (error: unknown) {
    const githubLimit = githubRateLimitResponse(error);
    if (githubLimit) return githubLimit;

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logError(error, { endpoint: "/api/cron/sync", operation: "cronSyncFatal" });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export const GET = POST;
