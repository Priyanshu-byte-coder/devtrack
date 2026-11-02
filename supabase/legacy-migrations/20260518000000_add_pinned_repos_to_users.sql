-- Migration: Add pinned_repos column to users table
-- Stores up to 3 pinned repository full_names (e.g. "owner/repo")

alter table users
  add column if not exists pinned_repos text[] not null default '{}';

-- Optional: enforce the 3-pin limit at the DB level as a safety net
alter table users
  add constraint pinned_repos_max_3
    check (array_length(pinned_repos, 1) is null or array_length(pinned_repos, 1) <= 3);
