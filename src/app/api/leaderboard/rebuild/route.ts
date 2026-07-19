// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { buildLeaderboard, setMemoryCachedLeaderboard, CACHE_STALE_SECONDS, LEADERBOARD_CACHE_KEY } from "@/lib/leaderboard";
import { cacheSet } from "@/lib/metrics-cache";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-devtrack-rebuild-token") ?? req.nextUrl.searchParams.get("token");
  const expected = process.env.LEADERBOARD_REBUILD_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await buildLeaderboard();
    await cacheSet(LEADERBOARD_CACHE_KEY, payload, CACHE_STALE_SECONDS);
    setMemoryCachedLeaderboard(payload);

    if (isSupabaseAdminAvailable) {
      try {
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + CACHE_STALE_SECONDS * 1000).toISOString();
        await supabaseAdmin.from("leaderboard_cache").upsert(
          {
            key: LEADERBOARD_CACHE_KEY,
            payload,
            generated_at: now,
            expires_at: expiresAt,
            building_until: null,
            updated_at: now,
          },
          { onConflict: "key" }
        );
      } catch (err) {
        console.warn("[Leaderboard] Failed to persist cache to Supabase during rebuild:", err);
      }
    }

    return NextResponse.json({ ok: true, generatedAt: payload.generatedAt });
  } catch (err) {
    console.error("[Leaderboard] Rebuild failed:", err);
    return NextResponse.json({ error: "Rebuild failed" }, { status: 500 });
  }
}
