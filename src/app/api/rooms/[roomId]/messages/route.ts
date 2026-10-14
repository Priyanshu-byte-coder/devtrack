import { getServerSession } from "@/lib/server-session";
import { authOptions } from '@/lib/auth';
import { getRoomById, getRoomMessages, getRoomMessagesSince, sendRoomMessage } from '@/lib/supabase-rooms';
import { validateTextInput } from '@/lib/sanitize';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session.githubLogin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const room = await getRoomById(roomId, session.githubId!);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const url = new URL(req.url);
  const after = url.searchParams.get('after') ?? undefined;
  const before = url.searchParams.get('before') ?? undefined;
  const afterId = url.searchParams.get('afterId') ?? undefined;
  if ([after, before].some(value => value !== undefined && !Number.isFinite(Date.parse(value))) || (afterId && (!after || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(afterId)))) {
    return NextResponse.json({ error: 'Invalid message cursor' }, { status: 400 });
  }
  const messages = after
    ? await getRoomMessagesSince(roomId, new Date(after).toISOString(), afterId)
    : await getRoomMessages(roomId, 50, before);
  return NextResponse.json(messages);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session.githubLogin)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const room = await getRoomById(roomId, session.githubId!);
  if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const validation = validateTextInput((body as Record<string, unknown>).content, 'content', 4000);
  if (!validation.ok)
    return NextResponse.json({ error: validation.error }, { status: 400 });
  const message = await sendRoomMessage(
    roomId,
    session.githubLogin,
    session.user?.image ?? null,
    validation.value,
    session.githubId
  );
  return NextResponse.json(message, { status: 201 });
}