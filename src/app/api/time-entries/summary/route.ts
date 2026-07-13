import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DAYS_IN_SUMMARY = 7;

function dateKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD" in UTC
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (DAYS_IN_SUMMARY - 1));
  since.setUTCHours(0, 0, 0, 0);

  const { data: entries, error } = await supabaseAdmin
    .from("time_entries")
    .select("started_at, duration_minutes")
    .eq("user_id", user.id)
    .gte("started_at", since.toISOString());

  if (error) {
    return Response.json({ error: "Failed to load time entries" }, { status: 500 });
  }

  const totalsByDay = new Map<string, number>();
  for (const entry of entries ?? []) {
    const key = dateKey(entry.started_at);
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + entry.duration_minutes);
  }

  const days: { date: string; totalMinutes: number }[] = [];
  for (let i = DAYS_IN_SUMMARY - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, totalMinutes: totalsByDay.get(key) ?? 0 });
  }

  return Response.json({ days });
}
