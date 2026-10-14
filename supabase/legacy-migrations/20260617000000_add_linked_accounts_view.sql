-- -------------------------------------------------------
-- linked_accounts: a stable public alias for user_github_accounts.
-- The underlying table already exists from the 20260516 migration.
-- This migration adds:
--   1. A `linked_accounts` view so the API routes in this feature
--      can use a consistent name without renaming the existing table.
--   2. RLS policies on user_github_accounts (if not already present).
-- -------------------------------------------------------

-- 1. Create the view
create or replace view linked_accounts as
  select
    id,
    user_id,
    github_id,
    github_login,
    access_token_encrypted,
    access_token_iv,
    added_at
  from user_github_accounts;

-- 2. Enable RLS on user_github_accounts (idempotent)
alter table user_github_accounts enable row level security;

-- 3. Users may only read their own linked accounts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_github_accounts'
      and policyname = 'user_github_accounts_select_own'
  ) then
    execute $policy$
      create policy "user_github_accounts_select_own"
        on user_github_accounts for select
        using (
          user_id = (
            select id from users where github_id = auth.uid()::text
          )
        )
    $policy$;
  end if;
end;
$$;

-- 4. Users may only delete their own linked accounts
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_github_accounts'
      and policyname = 'user_github_accounts_delete_own'
  ) then
    execute $policy$
      create policy "user_github_accounts_delete_own"
        on user_github_accounts for delete
        using (
          user_id = (
            select id from users where github_id = auth.uid()::text
          )
        )
    $policy$;
  end if;
end;
$$;