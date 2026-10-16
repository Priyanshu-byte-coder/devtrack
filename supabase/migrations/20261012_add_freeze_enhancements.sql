-- ==========================================
-- Supabase Migration: Streak Freeze Enhancements (#85400)
-- ==========================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS freeze_tokens_remaining INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_freeze_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS freeze_history JSONB DEFAULT '[]'::jsonb;
