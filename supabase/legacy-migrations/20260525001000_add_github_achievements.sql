create table if not exists user_github_achievements (
  user_id      text primary key references users(id) on delete cascade,
  github_login text not null,
  achievements jsonb not null default '[]'::jsonb,
  synced_at    timestamptz,
  fetch_error  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_user_github_achievements_login
  on user_github_achievements(github_login);

alter table user_github_achievements enable row level security;

drop policy if exists "user_github_achievements_select_own" on user_github_achievements;

create policy "user_github_achievements_select_own"
  on user_github_achievements for select
  using (user_id = auth.uid()::text);
