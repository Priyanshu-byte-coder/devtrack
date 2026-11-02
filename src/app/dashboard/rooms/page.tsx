import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRoomsForUser } from "@/lib/supabase-rooms";
import type { CollaborationRoom } from "@/types/rooms";
import RoomsListClient from "./RoomsListClient";

export const metadata = { title: "Rooms · DevTrack" };

export default async function RoomsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session.githubLogin) redirect("/api/auth/signin");

  let rooms: CollaborationRoom[] = [];
  let loadFailed = false;
  try {
    rooms = await getRoomsForUser(session.githubId);
  } catch (err) {
    console.error("[rooms] failed to load rooms:", err);
    loadFailed = true;
  }

  return (
    <RoomsListClient
      initialRooms={rooms}
      currentUser={session.githubLogin}
      loadFailed={loadFailed}
    />
  );
}
