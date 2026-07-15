-- Create activity_log table if not exists
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table activity_log enable row level security;

-- Policies for activity_log
create policy "activity_log_select" on activity_log
  for select using (
    exists (
      select 1 from projects p
      where p.id = activity_log.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "activity_log_insert" on activity_log
  for insert with check (
    exists (
      select 1 from projects p
      where p.id = activity_log.project_id
      and p.user_id = auth.uid()::text
    )
  );

-- Create index for performance
create index if not exists activity_log_project_id_created_at_idx on activity_log(project_id, created_at desc);
