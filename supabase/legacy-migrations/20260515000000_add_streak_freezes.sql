-- Migration: add streak_freezes table
-- Allows users to protect one streak day (e.g. weekends, sick days)

create table if not exists streak_freezes (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null references users(id) on delete cascade,
  freeze_date date not null,
  created_at  timestamptz default now()
);

create index if not exists streak_freezes_user on streak_freezes(user_id);

create unique index if not exists streak_freezes_user_date_uniq
  on streak_freezes(user_id, freeze_date);
