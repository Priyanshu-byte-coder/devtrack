import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getRoomById, getRoomMembers, getRoomMessages } from '@/lib/supabase-rooms';
import RoomClient from './RoomClient';

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) redirect('/api/auth/signin');
  const [room, members, messages] = await Promise.all([
    getRoomById(roomId, session.user.name),
    getRoomMembers(roomId),
    getRoomMessages(roomId, 50),
  ]);
  if (!room) notFound();
  return (
    <RoomClient
      room={room}
      initialMembers={members}
      initialMessages={messages}
      currentUser={session.user.name}
      currentUserAvatar={session.user.image ?? null}
    />
  );
}