-- Migration: Enable Row Level Security on all tables
-- Created: 2026-05-17
-- Description: Enables RLS and adds policies so users can only access their own data.
--              supabaseAdmin (service role key) bypasses RLS automatically for server-side ops.

-- ============================================================
-- USERS TABLE
-- ============================================================
alter table users enable row level security;

-- Users can only read their own row
create policy "users_select_own"
  on users for select
  using (id = auth.uid()::text);

-- Users can only update their own row
create policy "users_update_own"
  on users for update
  using (id = auth.uid()::text);

-- ============================================================
-- GOALS TABLE
-- ============================================================
alter table goals enable row level security;

-- Users can only read their own goals
create policy "goals_select_own"
  on goals for select
  using (user_id = auth.uid()::text);

-- Users can only insert goals for themselves
create policy "goals_insert_own"
  on goals for insert
  with check (user_id = auth.uid()::text);

-- Users can only update their own goals
create policy "goals_update_own"
  on goals for update
  using (user_id = auth.uid()::text);

-- Users can only delete their own goals
create policy "goals_delete_own"
  on goals for delete
  using (user_id = auth.uid()::text);

-- ============================================================
-- METRIC_SNAPSHOTS TABLE
-- ============================================================
alter table metric_snapshots enable row level security;

-- Users can only read their own snapshots
create policy "metric_snapshots_select_own"
  on metric_snapshots for select
  using (user_id = auth.uid()::text);

-- Users can only insert their own snapshots
create policy "metric_snapshots_insert_own"
  on metric_snapshots for insert
  with check (user_id = auth.uid()::text);

-- Users can only delete their own snapshots
create policy "metric_snapshots_delete_own"
  on metric_snapshots for delete
  using (user_id = auth.uid()::text);