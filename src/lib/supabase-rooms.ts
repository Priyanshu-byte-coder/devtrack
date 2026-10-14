import "server-only";
import type { Database } from "@/types/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  CollaborationRoom,
  RoomMember,
  RoomMessage,
  CreateRoomPayload,
} from "@/types/rooms";

type Tables = Database["public"]["Tables"];
function required(value: string | null, field: string): string {
  if (!value) throw new Error(`Room data is missing ${field}`);
  return value;
}
function normalizeRoom(
  row: Tables["collaboration_rooms"]["Row"]
): CollaborationRoom {
  return {
    ...row,
    created_at: required(row.created_at, "created_at"),
    updated_at: required(row.updated_at, "updated_at"),
  };
}
function normalizeMessage(row: Tables["room_messages"]["Row"]): RoomMessage {
  return {
    ...row,
    room_id: required(row.room_id, "room_id"),
    created_at: required(row.created_at, "created_at"),
  };
}

export async function getRoomsForUser(
  githubId: string
): Promise<CollaborationRoom[]> {
  const { data, error } = await supabaseAdmin
    .from("room_members")
    .select(
      `role, collaboration_rooms (id, name, description, repo_owner, repo_name, created_by, created_at, updated_at)`
    )
    .eq("github_id", githubId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row.collaboration_rooms,
    is_owner: row.role === "owner",
  }));
}

export async function createRoom(
  payload: CreateRoomPayload,
  creatorUsername: string,
  creatorGithubId: string
): Promise<CollaborationRoom> {
  const { data: room, error } = await supabaseAdmin
    .from("collaboration_rooms")
    .insert({ ...payload, created_by: creatorUsername })
    .select()
    .single();
  if (error) throw error;
  const { error: membershipError } = await supabaseAdmin
    .from("room_members")
    .insert({
      room_id: room.id,
      github_username: creatorUsername,
      github_id: creatorGithubId,
      role: "owner",
    });
  if (membershipError) {
    await supabaseAdmin.from("collaboration_rooms").delete().eq("id", room.id);
    throw membershipError;
  }
  return normalizeRoom(room);
}

export async function getRoomById(roomId: string, githubId: string) {
  const { data: membership } = await supabaseAdmin
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("github_id", githubId)
    .single();
  if (!membership) return null;
  const { data: room } = await supabaseAdmin
    .from("collaboration_rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  return room
    ? { ...normalizeRoom(room), is_owner: membership.role === "owner" }
    : null;
}

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  const { data, error } = await supabaseAdmin
    .from("room_members")
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    if (row.role !== "owner" && row.role !== "member")
      throw new Error("Invalid room member role");
    return {
      ...row,
      role: row.role,
      room_id: required(row.room_id, "room_id"),
      joined_at: required(row.joined_at, "joined_at"),
    };
  });
}

export async function addRoomMember(
  roomId: string,
  githubUsername: string,
  githubId: string
) {
  const { error } = await supabaseAdmin.from("room_members").insert({
    room_id: roomId,
    github_username: githubUsername,
    github_id: githubId,
    role: "member",
  });
  if (error) throw error;
}

export async function createRoomInvitation(
  roomId: string,
  githubUsername: string,
  invitedBy: string,
  githubId: string
) {
  const { data, error } = await supabaseAdmin
    .from("room_invitations")
    .insert({
      room_id: roomId,
      github_username: githubUsername,
      github_id: githubId,
      invited_by: invitedBy,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPendingInvitationsForUser(githubId: string) {
  const { data, error } = await supabaseAdmin
    .from("room_invitations")
    .select(
      `id, room_id, invited_by, created_at, collaboration_rooms (id, name, repo_owner, repo_name)`
    )
    .eq("github_id", githubId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRoomInvitation(invitationId: string) {
  const { data, error } = await supabaseAdmin
    .from("room_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();
  if (error) return null;
  return data;
}

export async function respondToRoomInvitation(
  invitationId: string,
  accept: boolean,
  githubId: string
) {
  const { data, error } = await supabaseAdmin.rpc(
    "respond_to_room_invitation",
    {
      p_invitation_id: invitationId,
      p_github_id: githubId,
      p_accept: accept,
    }
  );
  if (error) throw error;
  return data as { status: string } | null;
}

async function getUserIdByGithubLogin(
  githubLogin: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_login", githubLogin)
    .single();
  if (error) return null;
  return data?.id ?? null;
}

export async function notifyRoomInvitation(
  githubUsername: string,
  roomName: string,
  invitedBy: string
) {
  const userId = await getUserIdByGithubLogin(githubUsername);
  if (!userId) return;
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "room_invitation",
    message: `${invitedBy} invited you to join the room "${roomName}"`,
  });
  if (error) throw error;
}

export async function getRoomMessages(
  roomId: string,
  limit = 50,
  before?: string
): Promise<RoomMessage[]> {
  let query = supabaseAdmin
    .from("room_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reverse().map(normalizeMessage);
}

export async function getRoomMessagesSince(
  roomId: string,
  after: string,
  afterId?: string
): Promise<RoomMessage[]> {
  let query = supabaseAdmin
    .from("room_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);
  query = afterId
    ? query.or(
        `created_at.gt.${after},and(created_at.eq.${after},id.gt.${afterId})`
      )
    : query.gt("created_at", after);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeMessage);
}

export async function sendRoomMessage(
  roomId: string,
  senderUsername: string,
  senderAvatar: string | null,
  content: string,
  senderGithubId: string
): Promise<RoomMessage> {
  const { data, error } = await supabaseAdmin
    .from("room_messages")
    .insert({
      room_id: roomId,
      sender_username: senderUsername,
      sender_github_id: senderGithubId,
      sender_avatar: senderAvatar,
      content,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeMessage(data);
}

export async function removeRoomMember(
  roomId: string,
  membershipId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("id", membershipId);
  if (error) throw error;
}
