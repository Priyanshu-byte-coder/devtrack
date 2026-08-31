import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRoomById, removeRoomMember } from '@/lib/supabase-rooms';
import { NextResponse } from 'next/server';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ roomId: string; username: string }> }
) {
  const { roomId, username } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubLogin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const room = await getRoomById(roomId, session.githubLogin);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const targetUsername = username.trim().toLowerCase();
  const currentUser = session.githubLogin.toLowerCase();

  if (!targetUsername)
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 });

  const isSelf = targetUsername === currentUser;
  const isOwner = room.is_owner;

  if (!isSelf && !isOwner)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (isSelf && isOwner)
    return NextResponse.json(
      { error: 'Room owner cannot leave. Delete the room to remove it for everyone.' },
      { status: 400 }
    );

  try {
    await removeRoomMember(roomId, username.trim());
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
