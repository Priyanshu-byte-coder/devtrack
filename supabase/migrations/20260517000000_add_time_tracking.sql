-- Migration: add tasks and time_entries tables
-- Supports per-task Start/Stop time tracking with session history.

create table if not exists tasks (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  title      text not null,
  created_at timestamptz default now()
);

create index if not exists tasks_user on tasks(user_id);

create table if not exists time_entries (
  id                text primary key default gen_random_uuid()::text,
  task_id           text not null references tasks(id) on delete cascade,
  user_id           text not null references users(id) on delete cascade,
  started_at        timestamptz not null,
  ended_at          timestamptz not null,
  duration_minutes  integer not null,
  created_at        timestamptz default now(),
  constraint time_entries_ended_after_started check (ended_at > started_at)
);

create index if not exists time_entries_task on time_entries(task_id);
create index if not exists time_entries_user_started on time_entries(user_id, started_at);
