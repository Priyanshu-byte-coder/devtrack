import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getRoomById,
  getRoomMembers,
  getPendingInvite,
  createRoomInvite,
  getUserIdByGithubUsername,
} from '@/lib/supabase-rooms';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const room = await getRoomById(roomId, session.user.name);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!room.is_owner)
    return NextResponse.json({ error: 'Only the room owner can invite' }, { status: 403 });
  const { github_username } = await req.json();
  if (!github_username?.trim())
    return NextResponse.json({ error: 'github_username required' }, { status: 400 });
  // GitHub usernames: 1-39 chars, alphanumeric + hyphens, no leading/trailing hyphen
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(github_username))
    return NextResponse.json({ error: 'Invalid GitHub username' }, { status: 400 });
  const ghRes = await fetch(`https://api.github.com/users/${github_username}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
  if (ghRes.status === 404)
    return NextResponse.json({ error: `GitHub user "${github_username}" does not exist` }, { status: 404 });
  if (!ghRes.ok)
    return NextResponse.json({ error: 'Could not verify GitHub user' }, { status: 502 });
  
  const members = await getRoomMembers(roomId);
  if (members.some((m) => m.github_username === github_username))
    return NextResponse.json({ error: 'User is already a member' }, { status: 409 });

  const existingInvite = await getPendingInvite(roomId, github_username);
  if (existingInvite)
    return NextResponse.json({ error: 'An invite is already pending for this user' }, { status: 409 });

  await createRoomInvite(roomId, github_username, session.user.name);

  // Best-effort notification — the invite still exists even if this fails
  // (e.g. the invited user has never logged into DevTrack, so has no user row yet).
  try {
    const invitedUserId = await getUserIdByGithubUsername(github_username);
    if (invitedUserId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: invitedUserId,
        type: 'room_invite',
        message: `${session.user.name} invited you to join the room "${room.name}"`,
      });
    }
  } catch (err) {
    console.error('Failed to create room invite notification:', err);
  }

  return NextResponse.json({ success: true, status: 'pending' });
}