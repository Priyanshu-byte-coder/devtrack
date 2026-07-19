import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRoomById, getRoomMembers } from '@/lib/supabase-rooms';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const room = await getRoomById(roomId, session.user.name);
  if (!room) return NextResponse.json({ error: 'Not found or not a member' }, { status: 404 });
  const members = await getRoomMembers(roomId);
  return NextResponse.json({ ...room, members });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const room = await getRoomById(roomId, session.user.name);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!room.is_owner)
    return NextResponse.json({ error: 'Only the owner can delete this room' }, { status: 403 });

  const { error } = await supabaseAdmin
    .from('collaboration_rooms')
    .delete()
    .eq('id', roomId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}