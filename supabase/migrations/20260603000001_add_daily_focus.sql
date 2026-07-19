-- Create the daily_focus table
CREATE TABLE daily_focus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  goal_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a unique constraint for upserting
ALTER TABLE daily_focus ADD CONSTRAINT daily_focus_user_id_date_key UNIQUE (user_id, date);

-- Set up Row Level Security
ALTER TABLE daily_focus ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own focus goals
CREATE POLICY "Users can read own daily_focus"
  ON daily_focus FOR SELECT
  USING (auth.uid()::text = user_id);

-- Allow users to insert their own focus goals
CREATE POLICY "Users can insert own daily_focus"
  ON daily_focus FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Allow users to update their own focus goals
CREATE POLICY "Users can update own daily_focus"
  ON daily_focus FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Allow users to delete their own focus goals
CREATE POLICY "Users can delete own daily_focus"
  ON daily_focus FOR DELETE
  USING (auth.uid()::text = user_id);
