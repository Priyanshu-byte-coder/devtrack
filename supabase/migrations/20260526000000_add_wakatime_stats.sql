-- Add wakatime_stats table to cache daily wakatime summaries
CREATE TABLE wakatime_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- CHANGED FROM UUID TO TEXT
    date DATE NOT NULL,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE wakatime_stats ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own stats
-- (Note: Keep the drop/create pattern we learned earlier just in case!)
DROP POLICY IF EXISTS "Users can view their own wakatime stats" ON wakatime_stats;
CREATE POLICY "Users can view their own wakatime stats"
    ON wakatime_stats FOR SELECT
    USING (auth.uid()::text = user_id);