// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { refreshAllLeaderboardCaches } from "@/lib/leaderboard";

export async function POST(req: NextRequest) {
  // Header only. A `?token=` fallback would write the secret into access logs,
  // proxy logs and Referer headers.
  const token = req.headers.get("x-devtrack-rebuild-token");
  const expected = process.env.LEADERBOARD_REBUILD_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payloads = await refreshAllLeaderboardCaches();
    return NextResponse.json({
      ok: true,
      generatedAt: payloads.weekly.generatedAt,
      timeframes: Object.keys(payloads),
    });
  } catch (err) {
    console.error("[Leaderboard] Rebuild failed:", err);
    return NextResponse.json({ error: "Rebuild failed" }, { status: 500 });
  }
}
