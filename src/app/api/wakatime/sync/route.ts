import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/crypto";
import { validateCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  // Paginate the users query. The old implementation did one unbounded
  // `.select()` and pulled every wakatime user (plus their encrypted keys)
  // into serverless memory in a single response. At a few thousand users
  // that either hits Supabase's ~4.5 MB response cap, blows the function
  // timeout, or gets killed by the memory limit and the nightly sync
  // silently fails. Mirror the pattern used by /api/cron/sync (which was
  // already paginated) — 50-user pages, deterministic ordering by id,
  // break out when the page is short. See issue #3161.
  const PAGE_SIZE = 50;
  const CHUNK_SIZE = 5;
  let successCount = 0;
  let failureCount = 0;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, wakatime_api_key_encrypted, wakatime_api_key_iv")
      .not("wakatime_api_key_encrypted", "is", null)
      .not("wakatime_api_key_iv", "is", null)
      .order("id")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch users for wakatime sync:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!users || users.length === 0) {
      hasMore = false;
      break;
    }

    // Process each page in chunks to avoid overwhelming the Wakatime API
    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE);

      await Promise.allSettled(chunk.map(async (user) => {
        try {
          const apiKey = decryptToken(
            user.wakatime_api_key_encrypted!,
            user.wakatime_api_key_iv!
          );

          if (!apiKey) {
            console.error(`Decryption failed for user ${user.id}`);
            failureCount++;
            return;
          }

          // Fetch from Wakatime with no-store cache
          const res = await fetch("https://wakatime.com/api/v1/users/current/summaries?range=Last%207%20Days", {
            headers: {
              Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
            },
            cache: "no-store"
          });

          if (!res.ok) {
            console.error(`Wakatime API error for user ${user.id}: ${res.status}`);
            failureCount++;
            return;
          }

          const data = await res.json();
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
            console.error(`Failed to upsert wakatime stats for user ${user.id}:`, upsertError);
            failureCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          console.error(`Error processing wakatime stats for user ${user.id}:`, e);
          failureCount++;
        }
      }));
    }

    // Short page means we've reached the tail — stop paging.
    if (users.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return NextResponse.json({ success: successCount, failure: failureCount });
}