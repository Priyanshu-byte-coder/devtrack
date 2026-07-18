-- Add organizations_config column to users table to store organization sync settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS organizations_config jsonb DEFAULT '{}'::jsonb;
