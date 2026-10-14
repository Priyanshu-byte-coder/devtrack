create table if not exists streak_milestones (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  streak_count integer not null,
  achieved_at  timestamptz default now(),
  unique(user_id, streak_count)
);

create index if not exists streak_milestones_user on streak_milestones(user_id);
