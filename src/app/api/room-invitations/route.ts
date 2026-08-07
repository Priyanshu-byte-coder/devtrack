import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPendingInvitationsForUser } from "@/lib/supabase-rooms";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invitations = await getPendingInvitationsForUser(session.user.name);
  return NextResponse.json({ invitations });
}
