create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text not null default '',
  target_value integer not null check (target_value >= 1),
  current_value integer not null default 0 check (current_value >= 0),
  unit text not null default 'units',
  target_date date not null,
  category text not null default 'custom' check (category in ('commits', 'streak', 'projects', 'custom')),
  created_at timestamptz not null default now()
);

create index on milestones (user_id, created_at desc);
