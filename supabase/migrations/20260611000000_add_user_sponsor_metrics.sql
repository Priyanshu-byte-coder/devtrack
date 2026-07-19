-- Migration: Create user_sponsor_metrics table for caching GitHub sponsor data.
--

CREATE TABLE IF NOT EXISTS user_sponsor_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  mrr INTEGER NOT NULL DEFAULT 0,
  active_count INTEGER NOT NULL DEFAULT 0,
  growth_trend DOUBLE PRECISION NOT NULL DEFAULT 0,
  sparkline_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  sponsors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_sponsor_metrics ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist to prevent duplicate errors
DROP POLICY IF EXISTS "Users can read own sponsor metrics" ON user_sponsor_metrics;
DROP POLICY IF EXISTS "Users can insert own sponsor metrics" ON user_sponsor_metrics;
DROP POLICY IF EXISTS "Users can update own sponsor metrics" ON user_sponsor_metrics;
DROP POLICY IF EXISTS "Users can delete own sponsor metrics" ON user_sponsor_metrics;

-- Create policies cleanly
CREATE POLICY "Users can read own sponsor metrics"
  ON user_sponsor_metrics FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own sponsor metrics"
  ON user_sponsor_metrics FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own sponsor metrics"
  ON user_sponsor_metrics FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own sponsor metrics"
  ON user_sponsor_metrics FOR DELETE
  USING (auth.uid()::text = user_id);
