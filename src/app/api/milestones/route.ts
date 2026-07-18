import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { stripHtml } from "@/lib/sanitize";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_MILESTONES_PER_USER = 20;
const MAX_TITLE_LEN = 100;
const MAX_DESCRIPTION_LEN = 300;
const MAX_UNIT_LEN = 30;
const VALID_CATEGORIES = ["commits", "streak", "projects", "custom"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("milestones")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_MILESTONES_PER_USER);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 });
  }

  return NextResponse.json({ milestones: data ?? [] });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, description, targetValue, currentValue, unit, targetDate, category } =
    body as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
  }
  const safeTitle = stripHtml(title).slice(0, MAX_TITLE_LEN);
  if (safeTitle.length === 0) {
    return NextResponse.json({ error: "title must not be empty" }, { status: 400 });
  }

  const safeDescription =
    typeof description === "string"
      ? stripHtml(description).slice(0, MAX_DESCRIPTION_LEN)
      : "";

  if (
    typeof targetValue !== "number" ||
    !Number.isInteger(targetValue) ||
    targetValue < 1 ||
    targetValue > 1_000_000
  ) {
    return NextResponse.json(
      { error: "targetValue must be an integer between 1 and 1,000,000" },
      { status: 400 }
    );
  }

  const safeCurrentValue =
    typeof currentValue === "number" && Number.isInteger(currentValue) && currentValue >= 0
      ? Math.min(currentValue, targetValue)
      : 0;

  const safeUnit =
    typeof unit === "string" && unit.trim().length > 0
      ? unit.trim().slice(0, MAX_UNIT_LEN)
      : "units";

  if (typeof targetDate !== "string" || isNaN(new Date(targetDate).getTime())) {
    return NextResponse.json({ error: "targetDate must be a valid date string" }, { status: 400 });
  }

  const safeCategory: Category = VALID_CATEGORIES.includes(category as Category)
    ? (category as Category)
    : "custom";

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { count } = await supabaseAdmin
    .from("milestones")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= MAX_MILESTONES_PER_USER) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_MILESTONES_PER_USER} milestones.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("milestones")
    .insert({
      user_id: user.id,
      title: safeTitle,
      description: safeDescription,
      target_value: targetValue,
      current_value: safeCurrentValue,
      unit: safeUnit,
      target_date: targetDate,
      category: safeCategory,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }

  return NextResponse.json({ milestone: data }, { status: 201 });
}
