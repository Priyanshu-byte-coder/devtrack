import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import {
  getRoomById,
  getRoomMembers,
  getRoomMessages,
} from "@/lib/supabase-rooms";
import RoomClient from "./RoomClient";

interface Props {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session.githubLogin) redirect("/api/auth/signin");
  const room = await getRoomById(roomId, session.githubId);
  if (!room) notFound();
  const [members, messages] = await Promise.all([
    getRoomMembers(roomId),
    getRoomMessages(roomId, 50),
  ]);
  return (
    <RoomClient
      room={room}
      initialMembers={members}
      initialMessages={messages}
      currentUser={session.githubLogin}
      currentUserAvatar={session.user?.image ?? null}
    />
  );
}
