-- Add streak freeze enhancement columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS freeze_tokens_remaining INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_freeze_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS freeze_history JSONB DEFAULT '[]'::jsonb;

-- Add a check constraint to ensure tokens don't go negative
ALTER TABLE profiles 
ADD CONSTRAINT freeze_tokens_non_negative 
CHECK (freeze_tokens_remaining >= 0);

-- Create an index for faster queries on freeze data
CREATE INDEX IF NOT EXISTS idx_profiles_freeze_tokens 
ON profiles(freeze_tokens_remaining, last_freeze_date);

-- Add comment for documentation
COMMENT ON COLUMN profiles.freeze_tokens_remaining IS 'Number of streak freeze tokens available to the user (refreshes monthly)';
COMMENT ON COLUMN profiles.last_freeze_date IS 'Date when the user last used a freeze token';
COMMENT ON COLUMN profiles.freeze_history IS 'JSON array of freeze events: [{date: timestamp, reason: string}]';