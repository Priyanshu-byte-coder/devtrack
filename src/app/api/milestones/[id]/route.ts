import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { currentValue } = body as Record<string, unknown>;

  if (
    typeof currentValue !== "number" ||
    !Number.isInteger(currentValue) ||
    currentValue < 0
  ) {
    return NextResponse.json(
      { error: "currentValue must be a non-negative integer" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("milestones")
    .select("target_value")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  const safeCurrentValue = Math.min(currentValue, existing.target_value);

  const { data, error } = await supabaseAdmin
    .from("milestones")
    .update({ current_value: safeCurrentValue })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }

  return NextResponse.json({ milestone: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("milestones")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
