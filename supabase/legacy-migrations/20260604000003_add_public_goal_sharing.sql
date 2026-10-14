alter table public.goals
  add column if not exists is_public boolean not null default false;

create index if not exists goals_public_share_lookup_idx
  on public.goals (user_id, id)
  where is_public = true;

drop policy if exists "Public goals are readable when shared" on public.goals;

create policy "Public goals are readable when shared"
  on public.goals
  for select
  using (is_public = true);