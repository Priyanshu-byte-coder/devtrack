create table if not exists user_github_accounts (
  id                     text primary key default gen_random_uuid()::text,
  user_id                text not null references users(id) on delete cascade,
  github_id              text not null,
  github_login           text not null,
  access_token_encrypted text not null,
  access_token_iv        text not null,
  added_at               timestamptz default now(),
  unique (user_id, github_id)
);

create index if not exists user_github_accounts_user_id_idx
  on user_github_accounts(user_id);
