-- Migration: add last_ai_summary_at to users for AI summary rate limiting
--
-- Stores the timestamp of the most recent AI-generated weekly summary for each
-- user.  The application enforces a maximum of one generated summary per user
-- per 24-hour window by comparing this value against the current time before
-- calling the Anthropic API.
--
-- Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so repeated runs are safe.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_ai_summary_at TIMESTAMPTZ;

-- Index allows fast per-user lookups when enforcing the rate limit.
-- The partial condition skips the large number of users who have never
-- generated a summary (NULL values), keeping the index small.
CREATE INDEX IF NOT EXISTS users_last_ai_summary_at_idx
  ON users (id, last_ai_summary_at)
  WHERE last_ai_summary_at IS NOT NULL;
