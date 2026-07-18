import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";

export const dynamic = "force-dynamic";

// PATCH /api/notifications/[id] — mark single notification as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const notificationId = resolvedParams.id;

  // Fetch the notification first to verify ownership
  const { data: notification, error: fetchError } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (fetchError || !notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  if (notification.user_id !== user.id) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.read !== 'boolean') {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("notifications")
    .update({ read: body.read })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/notifications/[id] — delete a single notification
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const notificationId = resolvedParams.id;

  // Verify ownership before deleting
  const { data: notification, error: fetchError } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id")
    .eq("id", notificationId)
    .maybeSingle();

  if (fetchError || !notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  if (notification.user_id !== user.id) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}