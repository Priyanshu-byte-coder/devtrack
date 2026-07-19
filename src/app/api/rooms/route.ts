import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createRoom, getRoomsForUser } from '@/lib/supabase-rooms';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import type { CreateRoomPayload } from '@/types/rooms';

const MAX_ROOMS_PER_USER = 20;
const MAX_NAME_LEN = 100;
const MAX_DESCRIPTION_LEN = 500;

// GitHub enforces username ≤ 39 chars and repo name ≤ 100 chars.
const GITHUB_USERNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/;
const GITHUB_REPO_RE = /^[a-zA-Z0-9._-]{1,100}$/;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rooms = await getRoomsForUser(session.user.name);
    return NextResponse.json(rooms);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CreateRoomPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim() ?? '';
  const repoOwner = body.repo_owner?.trim() ?? '';
  const repoName = body.repo_name?.trim() ?? '';
  const description = body.description?.trim() ?? '';

  if (!name)
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (name.length > MAX_NAME_LEN)
    return NextResponse.json({ error: `name must be ${MAX_NAME_LEN} characters or fewer` }, { status: 400 });

  if (!repoOwner)
    return NextResponse.json({ error: 'repo_owner is required' }, { status: 400 });
  if (!GITHUB_USERNAME_RE.test(repoOwner))
    return NextResponse.json({ error: 'repo_owner must be a valid GitHub username (1–39 alphanumeric characters or hyphens, cannot start or end with a hyphen)' }, { status: 400 });

  if (!repoName)
    return NextResponse.json({ error: 'repo_name is required' }, { status: 400 });
  if (!GITHUB_REPO_RE.test(repoName))
    return NextResponse.json({ error: 'repo_name must be a valid GitHub repository name (1–100 characters, alphanumeric, hyphens, underscores, or dots)' }, { status: 400 });

  if (description.length > MAX_DESCRIPTION_LEN)
    return NextResponse.json({ error: `description must be ${MAX_DESCRIPTION_LEN} characters or fewer` }, { status: 400 });

  // Enforce per-user room ownership cap.
  const { count, error: countError } = await supabaseAdmin
    .from('room_members')
    .select('*', { count: 'exact', head: true })
    .eq('github_username', session.user.name)
    .eq('role', 'owner');

  if (countError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });

  if ((count ?? 0) >= MAX_ROOMS_PER_USER)
    return NextResponse.json(
      { error: `You can own at most ${MAX_ROOMS_PER_USER} rooms` },
      { status: 429 }
    );

  try {
    const room = await createRoom(
      { name, repo_owner: repoOwner, repo_name: repoName, description: description || undefined },
      session.user.name
    );
    return NextResponse.json(room, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
