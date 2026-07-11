import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPendingInvitesForUser } from '@/lib/supabase-rooms';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invites = await getPendingInvitesForUser(session.user.name);
  return NextResponse.json({ invites });
}