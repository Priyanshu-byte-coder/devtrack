import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

async function getAppUserId(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) return null;
  const user = await resolveAppUser(session.githubId, session.githubLogin);
  return user?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAppUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const todayDate = today.toISOString().split("T")[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split("T")[0];

    const { data: todayData, error: todayError } = await supabaseAdmin
      .from("daily_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("date", todayDate)
      .single();

    if (todayError && todayError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch daily notes" },
        { status: 500 }
      );
    }

    const { data: yesterdayData, error: yesterdayError } = await supabaseAdmin
      .from("daily_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("date", yesterdayDate)
      .single();

    if (yesterdayError && yesterdayError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch daily notes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      todayNote: todayData?.note || "",
      yesterdayNote: yesterdayData?.note || "",
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAppUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { note } = body;

    if (!note || !note.trim()) {
      return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });
    }

    if (note.length > 280) {
      return NextResponse.json({ error: "Maximum 280 characters allowed" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabaseAdmin
      .from("daily_notes")
      .upsert(
        { user_id: userId, date: today, note: note.trim() },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
