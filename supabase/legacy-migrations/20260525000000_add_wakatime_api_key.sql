-- Migration to add wakatime_api_key columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS wakatime_api_key_encrypted text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wakatime_api_key_iv text;
