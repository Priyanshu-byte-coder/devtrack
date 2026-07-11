CREATE TABLE IF NOT EXISTS room_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  invited_username TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(room_id, invited_username)
);

CREATE INDEX IF NOT EXISTS room_invites_invited_username_idx
  ON room_invites(invited_username, status);

CREATE INDEX IF NOT EXISTS room_invites_room_id_idx
  ON room_invites(room_id);

ALTER TABLE room_invites ENABLE ROW LEVEL SECURITY;
