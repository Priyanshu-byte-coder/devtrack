-- Add public_widgets jsonb column to users table
-- This stores which widgets the user has opted to show on their public profile.
-- Default shows streak and contributions; languages and PRs are opt-in.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_widgets jsonb NOT NULL DEFAULT '["streak","contributions"]'::jsonb;
 
COMMENT ON COLUMN users.public_widgets IS
  'Array of widget keys the user wants visible on their public /u/[username] page. '
  'Allowed values: "streak", "contributions", "languages", "prs".';
 