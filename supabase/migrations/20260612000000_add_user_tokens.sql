create table if not exists user_tokens (
  user_id         text primary key references users(id) on delete cascade,
  encrypted_token text not null,
  token_iv        text not null,
  updated_at      timestamptz default now()
);

alter table user_tokens enable row level security;

create policy "user_tokens_select_own"
  on user_tokens for select
  using (user_id = auth.uid()::text);

create policy "user_tokens_insert_own"
  on user_tokens for insert
  with check (user_id = auth.uid()::text);

create policy "user_tokens_update_own"
  on user_tokens for update
  using (user_id = auth.uid()::text);