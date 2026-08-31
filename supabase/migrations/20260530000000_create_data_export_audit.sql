create table if not exists data_export_audit (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null references users(id) on delete cascade, -- CHANGED FROM UUID TO TEXT
  -- 'export' = GET /api/user/data-export
  -- 'delete' = DELETE /api/user/data-export
  action      text        not null check (action in ('export', 'delete')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Index used by the rate-limit query:
--   WHERE user_id = $1 AND action = 'export' AND created_at >= $2
create index if not exists data_export_audit_user_action_time
  on data_export_audit (user_id, action, created_at desc);

-- Optional: auto-purge records older than 90 days to limit table growth.
-- Enable pg_cron and uncomment if supported on your Supabase plan:
--
-- select cron.schedule(
--   'purge-old-export-audit',
--   '0 3 * * *',
--   $$delete from data_export_audit where created_at < now() - interval '90 days'$$
-- );