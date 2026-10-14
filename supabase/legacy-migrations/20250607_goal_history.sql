create table if not exists goal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  target numeric not null,
  achieved numeric not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index on goal_history (user_id, period_end desc);