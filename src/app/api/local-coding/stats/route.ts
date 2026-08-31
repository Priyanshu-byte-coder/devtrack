import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = [7, 30, 90];
const DEFAULT_DAYS = 30;

function validateDays(days: number): number {
  if (ALLOWED_DAYS.includes(days)) {
    return days;
  }
  return DEFAULT_DAYS;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const rawDays = parseInt(searchParams.get("days") || "30", 10);
  const days = validateDays(isNaN(rawDays) ? DEFAULT_DAYS : rawDays);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().slice(0, 10);

  const { data: sessions, error } = await supabaseAdmin
    .from("local_coding_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", fromDateStr)
    .order("date", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      // Table may not exist in all deployments — degrade gracefully
      return Response.json({
        dailyData: [],
        totals: { totalSeconds: 0, totalDays: 0, avgSecondsPerDay: 0 },
        hasData: false,
      });
    }
    console.error("Failed to fetch local coding stats:", error);
    return Response.json(
      { error: "Failed to fetch local coding stats" },
      { status: 500 }
    );
  }

  if (!sessions || sessions.length === 0) {
    return Response.json({
      dailyData: [],
      totals: {
        totalSeconds: 0,
        totalDays: 0,
        avgSecondsPerDay: 0,
      },
      hasData: false,
    });
  }

  const dailyData = (sessions as {
    date: string;
    total_seconds: number;
    file_count: number;
    project_count: number;
  }[]).map((s) => ({
    date: s.date,
    totalSeconds: s.total_seconds,
    fileCount: s.file_count,
    projectCount: s.project_count,
  }));

  const totalSeconds = dailyData.reduce((sum, d) => sum + d.totalSeconds, 0);
  const totalDays = dailyData.length;

  return Response.json({
    dailyData,
    totals: {
      totalSeconds,
      totalDays,
      avgSecondsPerDay: Math.round(totalSeconds / totalDays),
    },
    hasData: true,
  });
}
