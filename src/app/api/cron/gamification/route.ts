/**
 * Daily gamification cron: rank snapshots, progress, and season close.
 *
 * Triggered by Vercel Cron once a day just after midnight UTC (vercel.json).
 * Self-hosted deployments can call it from any scheduler with
 * `Authorization: Bearer <CRON_SECRET>`.
 */

import { validateCronRequest } from "@/lib/cron-auth";
import { claimCronBatch } from "@/lib/cron-batch";
import { captureGamification } from "@/lib/gamification/persistence";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const denied = validateCronRequest(req);
  if (denied) return denied;

  let batch: Awaited<ReturnType<typeof claimCronBatch>>;
  try {
    batch = await claimCronBatch("gamification");
  } catch {
    return Response.json({ error: "Cron state unavailable" }, { status: 503 });
  }
  if (!batch)
    return Response.json({ skipped: true, reason: "Job already running" });

  try {
    const summary = await captureGamification();
    await batch.finish(null);
    return Response.json(summary);
  } catch (error) {
    // Leave the lease to expire rather than finishing it, so a crashed run
    // can't be mistaken for a completed one; the next trigger retries.
    console.error("[cron/gamification] failed:", error);
    return Response.json(
      { error: "Gamification capture failed" },
      { status: 500 }
    );
  }
}
