-- Adds a pending-invitation flow for collaboration rooms.
-- Previously, inviting a user via github_username added them to
-- room_members immediately. This table stores a pending invitation
-- that the invited user must accept before becoming a room member.

CREATE TABLE IF NOT EXISTS room_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(room_id, github_username, status)
);

CREATE INDEX IF NOT EXISTS room_invitations_invitee_idx
  ON room_invitations(github_username, status);

ALTER TABLE room_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitation_select" ON room_invitations;
CREATE POLICY "invitation_select" ON room_invitations
  FOR SELECT USING (
    github_username = current_setting('request.jwt.claims', true)::json->>'login'
    OR EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_invitations.room_id
        AND github_username = current_setting('request.jwt.claims', true)::json->>'login'
        AND role = 'owner'
    )
  );