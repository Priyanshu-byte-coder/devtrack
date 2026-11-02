-- Add weekly_digest_opt_in and email to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_digest_opt_in BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
