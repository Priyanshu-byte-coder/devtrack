-- Migration: add jira_credentials table for Jira integration
-- Stores encrypted API tokens for connecting to Jira

create table if not exists jira_credentials (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null unique references users(id) on delete cascade,
  jira_domain  text not null,
  email        text not null,
  api_token    text not null,
  token_iv     text not null,
  project_key  text,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists jira_credentials_user on jira_credentials(user_id);
