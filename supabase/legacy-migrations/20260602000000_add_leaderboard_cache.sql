-- Migration: Add persistent leaderboard_cache table
-- Adds a shared cache row for the public leaderboard and a simple locking column

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  key text primary key,
  payload jsonb,
  generated_at timestamptz,
  expires_at timestamptz,
  building_until timestamptz,
  updated_at timestamptz default now()
);
