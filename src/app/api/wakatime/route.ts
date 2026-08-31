import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseAdminAvailable) {
    return NextResponse.json({ hasData: false, not_configured: true });
  }

  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, wakatime_api_key_encrypted")
      .eq("github_id", session.githubId)
      .single();

    if (userError) {
      if (userError.code === "PGRST116") {
        return NextResponse.json({ hasData: false, not_configured: true });
      }
      console.error("Failed to fetch user for Wakatime stats:", userError);
      return NextResponse.json(
        { error: "Failed to fetch Wakatime stats" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ hasData: false, not_configured: true });
    }

    if (!user.wakatime_api_key_encrypted) {
      return NextResponse.json({ hasData: false, not_configured: true });
    }

    const date7DaysAgo = new Date();
    date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
    const dateStr = date7DaysAgo.toISOString().split("T")[0];

    const { data: stats, error: statsError } = await supabaseAdmin
      .from("wakatime_stats")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", dateStr)
      .order("date", { ascending: true });

    if (statsError) {
      console.error("Failed to fetch Wakatime stats:", statsError);
      return NextResponse.json(
        { error: "Failed to fetch Wakatime stats" },
        { status: 500 }
      );
    }

    if (!stats || stats.length === 0) {
      return NextResponse.json({ hasData: false });
    }

    const today = stats[stats.length - 1];
    const todaysSeconds = today?.total_seconds || 0;

    let totalSeconds7Days = 0;
    const languagesMap: Record<string, number> = {};
    const projectsMap: Record<string, number> = {};

    const chartData = stats.map((day: any) => {
      const totalSeconds = day.total_seconds || 0;
      totalSeconds7Days += totalSeconds;

      (day.languages || []).forEach((lang: any) => {
        languagesMap[lang.name] = (languagesMap[lang.name] || 0) + lang.total_seconds;
      });

      (day.projects || []).forEach((proj: any) => {
        projectsMap[proj.name] = (projectsMap[proj.name] || 0) + proj.total_seconds;
      });

      return {
        date: day.date,
        hours: parseFloat((totalSeconds / 3600).toFixed(2)),
      };
    });

    const getTop = (map: Record<string, number>) =>
      Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    return NextResponse.json({
      hasData: true,
      todaysSeconds,
      totalSeconds7Days,
      chartData,
      topLanguage: getTop(languagesMap),
      topProject: getTop(projectsMap),
    });
  } catch (err) {
    console.error("Unexpected error in Wakatime GET:", err);
    return NextResponse.json(
      { error: "Failed to fetch Wakatime stats" },
      { status: 500 }
    );
  }
}
