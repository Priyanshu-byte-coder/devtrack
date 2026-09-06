import { NextResponse } from "next/server";
import { refreshAllLeaderboardCaches } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payloads = await refreshAllLeaderboardCaches();
    return NextResponse.json({
      success: true,
      generatedAt: payloads.weekly.generatedAt,
      timeframes: Object.keys(payloads),
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to refresh leaderboard cache" }, { status: 500 });
  }
}
