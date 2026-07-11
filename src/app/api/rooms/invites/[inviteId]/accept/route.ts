import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { acceptRoomInvite } from '@/lib/supabase-rooms';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await acceptRoomInvite(inviteId, session.user.name);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to accept room invite:', err);
    return NextResponse.json({ error: 'Invite not found or already resolved' }, { status: 409 });
  }
}