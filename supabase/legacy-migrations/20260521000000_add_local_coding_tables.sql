create table if not exists local_coding_sessions (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  date         date not null,
  total_seconds integer not null default 0,
  file_count   integer not null default 0,
  project_count integer not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(user_id, date)
);

create index if not exists local_coding_sessions_user_date on local_coding_sessions(user_id, date);

create table if not exists local_coding_api_keys (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  api_key      text not null unique,
  name         text not null,
  last_used_at  timestamptz,
  created_at   timestamptz default now()
);

create index if not exists local_coding_api_keys_user on local_coding_api_keys(user_id);
create index if not exists local_coding_api_keys_key on local_coding_api_keys(api_key);
