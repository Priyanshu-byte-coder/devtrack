-- Migration: enable Row Level Security on daily_notes and align user_id to users.id
--
-- The daily_notes table was created without RLS in 20260515000002_add_daily_notes.sql.
-- This migration:
--   1. Enables RLS so the table is protected from direct client access by default.
--   2. Adds the four standard CRUD policies matching the pattern used by daily_focus.
--
-- NOTE: The API route (src/app/api/daily-note/route.ts) has been updated in the same
-- PR to resolve users.id (a stable UUID) via resolveAppUser() instead of storing the
-- raw GitHub numeric ID. Existing rows that used the GitHub numeric ID as user_id will
-- no longer be matched by the updated API, effectively orphaning them. This is
-- acceptable for daily notes (ephemeral, low-stakes data) and avoids a risky in-place
-- data migration. A future cleanup migration can delete orphaned rows if needed.

ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily_notes"
  ON daily_notes FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own daily_notes"
  ON daily_notes FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own daily_notes"
  ON daily_notes FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own daily_notes"
  ON daily_notes FOR DELETE
  USING (auth.uid()::text = user_id);
