import { getServerSession } from "@/lib/server-session";
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
  if (!session?.githubId || !session.githubLogin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invitation = await getRoomInvitation(invitationId);
  if (!invitation)
    return NextResponse.json(
      { error: "Invitation not found" },
      { status: 404 }
    );
  if (invitation.github_id !== session.githubId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (invitation.status !== "pending")
    return NextResponse.json(
      { error: "Invitation already responded to" },
      { status: 409 }
    );

  let body: unknown;
  try {body=await req.json();} catch {return NextResponse.json({error:"Invalid JSON"},{status:400});}
  const action=body && typeof body === "object" ? (body as {action?: unknown}).action : undefined;
  if (action !== "accept" && action !== "decline")
    return NextResponse.json(
      { error: 'action must be "accept" or "decline"' },
      { status: 400 }
    );

  try {
  const updated = await respondToRoomInvitation(
    invitationId,
    action === "accept",
    session.githubId
  );
  if(!updated) return NextResponse.json({error:"Invitation already responded to"},{status:409});
  return NextResponse.json({ success: true, status: updated.status });
  } catch {return NextResponse.json({error:"Invitation response failed"},{status:503});}
}
