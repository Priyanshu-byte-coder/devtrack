import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getRoomInvitation,
  respondToRoomInvitation,
} from "@/lib/supabase-rooms";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const { invitationId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invitation = await getRoomInvitation(invitationId);
  if (!invitation)
    return NextResponse.json(
      { error: "Invitation not found" },
      { status: 404 }
    );
  if (invitation.github_username !== session.user.name)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (invitation.status !== "pending")
    return NextResponse.json(
      { error: "Invitation already responded to" },
      { status: 409 }
    );

  const { action } = await req.json();
  if (action !== "accept" && action !== "decline")
    return NextResponse.json(
      { error: 'action must be "accept" or "decline"' },
      { status: 400 }
    );

  const updated = await respondToRoomInvitation(
    invitationId,
    action === "accept"
  );
  return NextResponse.json({ success: true, status: updated?.status });
}
