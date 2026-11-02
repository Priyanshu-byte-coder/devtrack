-- Explicit opt-in for public leaderboard visibility.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_leaderboard_opt_in_idx
ON users(leaderboard_opt_in)
WHERE leaderboard_opt_in = true;
