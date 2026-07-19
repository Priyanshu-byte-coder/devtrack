-- Migration: add recurrence field to goals table
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;

-- Make period_start nullable so existing rows still work
ALTER TABLE goals ALTER COLUMN period_start DROP NOT NULL;

-- Backfill period_start for existing goals
UPDATE goals SET period_start = created_at WHERE period_start IS NULL;

-- Add index for faster period queries
CREATE INDEX IF NOT EXISTS idx_goals_recurrence ON goals(recurrence);
