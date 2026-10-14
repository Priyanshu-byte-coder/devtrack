import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getPendingInvitationsForUser } from "@/lib/supabase-rooms";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session.githubLogin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invitations = await getPendingInvitationsForUser(session.githubId!);
  return NextResponse.json({ invitations });
}
