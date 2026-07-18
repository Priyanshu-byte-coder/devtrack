create table if not exists webhook_configs (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  name         text not null,
  url          text not null,
  events       text[] not null default '{}',
  secret_key   text not null,
  secret_iv    text,
  is_enabled   boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists webhook_configs_user on webhook_configs(user_id);

create table if not exists webhook_deliveries (
  id            text primary key default gen_random_uuid()::text,
  webhook_id    text not null references webhook_configs(id) on delete cascade,
  event         text not null,
  payload       jsonb not null,
  status_code   integer,
  success       boolean default false,
  error_message text,
  delivered_at  timestamptz default now()
);

create index if not exists webhook_deliveries_webhook on webhook_deliveries(webhook_id);
create index if not exists webhook_deliveries_time on webhook_deliveries(delivered_at);
