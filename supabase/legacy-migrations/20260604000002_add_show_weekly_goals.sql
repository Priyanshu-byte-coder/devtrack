ALTER TABLE users
ADD COLUMN IF NOT EXISTS show_weekly_goals boolean NOT NULL DEFAULT false;
