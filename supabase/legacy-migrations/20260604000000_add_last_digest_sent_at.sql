-- Track when each user last received a weekly digest email.
-- Used by the cron endpoint to prevent duplicate sends within a 6-day
-- cooldown window (e.g. if the cron fires twice in the same week due to
-- a scheduler misconfiguration or a manual re-trigger).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Index so the cron query can efficiently filter by this column when
-- implementing cooldown checks against large user tables.
CREATE INDEX IF NOT EXISTS users_last_digest_sent_at_idx
  ON users (last_digest_sent_at);
