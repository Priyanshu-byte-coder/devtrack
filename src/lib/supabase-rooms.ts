import 'server-only';
import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  CollaborationRoom,
  RoomMember,
  RoomMessage,
  CreateRoomPayload,
} from "@/types/rooms";

export async function getRoomsForUser(username: string): Promise<CollaborationRoom[]> {
  const { data, error } = await supabaseAdmin
    .from("room_members")
    .select(`role, collaboration_rooms (id, name, description, repo_owner, repo_name, created_by, created_at, updated_at)`)
    .eq("github_username", username);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row.collaboration_rooms, is_owner: row.role === "owner" }));
}

export async function createRoom(payload: CreateRoomPayload, creatorUsername: string): Promise<CollaborationRoom> {
  const { data: room, error } = await supabaseAdmin.from("collaboration_rooms").insert({ ...payload, created_by: creatorUsername }).select().single();
  if (error) throw error;
  await supabaseAdmin.from("room_members").insert({ room_id: room.id, github_username: creatorUsername, role: "owner" });
  return room;
}

export async function getRoomById(roomId: string, username: string) {
  const { data: membership } = await supabaseAdmin.from("room_members").select("role").eq("room_id", roomId).eq("github_username", username).single();
  if (!membership) return null;
  const { data: room } = await supabaseAdmin.from("collaboration_rooms").select("*").eq("id", roomId).single();
  return room ? { ...room, is_owner: membership.role === "owner" } : null;
}

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  const { data, error } = await supabaseAdmin.from("room_members").select("*").eq("room_id", roomId).order("joined_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addRoomMember(roomId: string, githubUsername: string) {
  const { error } = await supabaseAdmin.from("room_members").insert({ room_id: roomId, github_username: githubUsername, role: "member" });
  if (error) throw error;
}

export async function getRoomMessages(roomId: string, limit = 50, before?: string): Promise<RoomMessage[]> {
  let query = supabaseAdmin.from("room_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function getRoomMessagesSince(roomId: string, after: string): Promise<RoomMessage[]> {
  const { data, error } = await supabaseAdmin
    .from("room_messages")
    .select("*")
    .eq("room_id", roomId)
    .gt("created_at", after)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendRoomMessage(roomId: string, senderUsername: string, senderAvatar: string | null, content: string): Promise<RoomMessage> {
  const { data, error } = await supabaseAdmin.from("room_messages").insert({ room_id: roomId, sender_username: senderUsername, sender_avatar: senderAvatar, content }).select().single();
  if (error) throw error;
  return data;
}

export async function removeRoomMember(roomId: string, githubUsername: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("github_username", githubUsername);
  if (error) throw error;
}
