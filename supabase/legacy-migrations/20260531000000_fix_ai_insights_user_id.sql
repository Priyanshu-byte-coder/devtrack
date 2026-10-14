-- Migration: fix ai_insights ownership and referential integrity
--
-- Problem
-- -------
-- ai_insights.user_id was populated with session.githubId (a numeric GitHub
-- account ID stored as text, e.g. "12345678") instead of users.id (the
-- application UUID, e.g. "550e8400-..."). As a result:
--
--   1. No foreign-key constraint existed, so rows could reference
--      non-existent "users".
--   2. ON DELETE CASCADE could not fire because there was no FK relationship,
--      leaving ai_insights rows permanently orphaned after account deletion.
--   3. The unique index on (user_id, insight_type) operated on GitHub IDs
--      rather than application user IDs, making the constraint meaningless
--      for ownership isolation.
--
-- This migration:
--   1. Remaps existing user_id values from github_id → users.id using the
--      users.github_id column that links the two identity spaces.
--   2. Deletes any rows that cannot be mapped (accounts already deleted).
--   3. Adds a proper FOREIGN KEY referencing users(id) ON DELETE CASCADE.
--
-- The unique index idx_ai_insights_user_type already covers (user_id,
-- insight_type) and remains valid after the remap because every user has
-- at most one insight row per type.

BEGIN;

-- Step 1: Remap github_id values to application UUIDs.
--         ai_insights.user_id currently holds values equal to users.github_id.
--         After this UPDATE each row will hold the corresponding users.id UUID.
UPDATE ai_insights AS ai
SET user_id = u.id
FROM users AS u
WHERE u.github_id = ai.user_id;

-- Step 2: Remove rows that could not be matched (the originating user account
--         no longer exists in the database). These are already orphaned records;
--         deleting them here is correct and expected.
DELETE FROM ai_insights
WHERE user_id NOT IN (SELECT id FROM users);

-- Step 3: Enforce referential integrity going forward.
--         ON DELETE CASCADE ensures rows are removed automatically when their
--         owning user account is deleted, preventing future orphans.
ALTER TABLE ai_insights
  ADD CONSTRAINT ai_insights_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE;

COMMIT;
