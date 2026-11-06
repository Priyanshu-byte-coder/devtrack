import { validateCronRequest } from "@/lib/cron-auth";
import { claimCronBatch } from "@/lib/cron-batch";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/crypto";
import { syncGoalsForUser } from "@/lib/goals-sync";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(req: Request) {
  const denied = validateCronRequest(req);
  if (denied) return denied;
  try {
    const batch = await claimCronBatch("goals-sync");
    if (!batch)
      return Response.json({ skipped: true, reason: "Job already running" });
    let cursor = batch.cursor;
    let processed = 0,
      failed = 0;
    const started = Date.now();
    try {
      let query = supabaseAdmin
        .from("user_tokens")
        .select("user_id,encrypted_token,token_iv,users(github_login)")
        .order("user_id")
        .limit(100);
      if (cursor) query = query.gt("user_id", cursor);
      const { data, error } = await query;
      if (error) throw new Error("Sync recipients unavailable");
      for (const row of data ?? []) {
        if (Date.now() - started > 240_000) break;
        const token = decryptToken(row.encrypted_token, row.token_iv);
        if (!token || !row.users?.github_login) failed++;
        else {
          try {
            const { error: rolloverError } = await supabaseAdmin.rpc(
              "rollover_goals",
              { p_user_id: row.user_id, p_now: new Date().toISOString() }
            );
            if (rolloverError) throw new Error("Goal rollover unavailable");
            await syncGoalsForUser(row.user_id, row.users.github_login, token);
            processed++;
          } catch {
            failed++;
          }
        }
        cursor = row.user_id;
      }
      const remaining =
        (data?.length ?? 0) === 100 || processed + failed < (data?.length ?? 0);
      if (!remaining) cursor = null;
      return Response.json({ processed, failed, hasMore: remaining });
    } finally {
      await batch.finish(cursor);
    }
  } catch {
    return Response.json(
      { error: "Scheduled goal sync unavailable" },
      { status: 503 }
    );
  }
}
