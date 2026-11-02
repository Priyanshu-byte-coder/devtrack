-- Persist completed recurring goal periods before progress resets.
create table if not exists goal_history (
  id           text primary key default gen_random_uuid()::text,
  goal_id      text not null references goals(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  period_start timestamptz not null,
  period_end   timestamptz not null,
  target       integer not null,
  achieved     integer not null default 0,
  completed    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(goal_id, period_start)
);

create index if not exists goal_history_user_period
  on goal_history(user_id, period_end desc);

create index if not exists goal_history_goal_period
  on goal_history(goal_id, period_end desc);

alter table goal_history enable row level security;

-- Drop policies if they already exist to prevent duplicate errors
DROP POLICY IF EXISTS "goal_history_select_own" ON goal_history;
DROP POLICY IF EXISTS "goal_history_insert_own" ON goal_history;
DROP POLICY IF EXISTS "goal_history_delete_own" ON goal_history;

-- Create the policies cleanly
create policy "goal_history_select_own"
  on goal_history for select
  using (user_id = auth.uid()::text);

create policy "goal_history_insert_own"
  on goal_history for insert
  with check (user_id = auth.uid()::text);

create policy "goal_history_delete_own"
  on goal_history for delete
  using (user_id = auth.uid()::text);
