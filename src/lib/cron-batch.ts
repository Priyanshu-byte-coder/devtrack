import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
/** Lease and persist a cursor across serverless invocations. A failed process expires in 5 minutes. */
export async function claimCronBatch(name: string) {
  const token = crypto.randomUUID();
  const { data, error } = await supabaseAdmin.rpc("claim_cron_job", {
    p_name: name,
    p_token: token,
  });
  if (error) throw new Error("Cron state unavailable");
  if (!data) return null;
  const cursor = (data as { cursor: string | null }).cursor;
  return {
    cursor,
    async finish(nextCursor: string | null) {
      const { error } = await supabaseAdmin
        .from("cron_jobs")
        .update({
          cursor: nextCursor,
          lease_until: null,
          lease_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq("name", name)
        .eq("lease_token", token);
      if (error) throw new Error("Cron cursor could not be saved");
    },
  };
}
