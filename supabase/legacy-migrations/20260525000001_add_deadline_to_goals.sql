-- Add deadline column
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline timestamptz;
