export interface CollaborationRoom {
  id: string;
  name: string;
  description: string | null;
  repo_owner: string;
  repo_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields (from API responses)
  member_count?: number;
  is_owner?: boolean;
}

export interface RoomMember {
  id: string;
  room_id: string;
  github_username: string;
  role: 'owner' | 'member';
  joined_at: string;
  // From GitHub API
  avatar_url?: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender_username: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
}

export interface CreateRoomPayload {
  name: string;
  description?: string;
  repo_owner: string;
  repo_name: string;
}

export interface InvitePayload {
  room_id: string;
  github_username: string;
}

export interface SendMessagePayload {
  room_id: string;
  content: string;
}