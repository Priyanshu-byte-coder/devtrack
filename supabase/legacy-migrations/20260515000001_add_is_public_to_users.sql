-- Add is_public column to users table for public profile feature
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Create index on is_public for query performance
CREATE INDEX IF NOT EXISTS users_is_public_idx ON users(is_public);
