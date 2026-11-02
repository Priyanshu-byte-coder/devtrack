-- Migration: Add user_github_orgs for GitHub Organization contribution support
-- Stores which organizations a user has discovered and their per-org metric
-- inclusion preference.  The primary token (read:org scope) is reused to
-- fetch org membership; no additional token storage is required.

create table if not exists user_github_orgs (
  id                 text        primary key default gen_random_uuid()::text,
  user_id            text        not null references users(id) on delete cascade,
  org_login          text        not null,
  org_id             text        not null,
  avatar_url         text,
  include_in_metrics boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (user_id, org_id)
);

create index if not exists user_github_orgs_user_id
  on user_github_orgs (user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table user_github_orgs enable row level security;

create policy "user_github_orgs_select_own"
  on user_github_orgs for select
  using (user_id = auth.uid()::text);

create policy "user_github_orgs_insert_own"
  on user_github_orgs for insert
  with check (user_id = auth.uid()::text);

create policy "user_github_orgs_update_own"
  on user_github_orgs for update
  using (user_id = auth.uid()::text);

create policy "user_github_orgs_delete_own"
  on user_github_orgs for delete
  using (user_id = auth.uid()::text);
