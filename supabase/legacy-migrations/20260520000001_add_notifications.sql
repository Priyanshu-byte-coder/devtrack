create table if not exists notifications (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  type       text not null,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_time
  on notifications(user_id, created_at desc);
