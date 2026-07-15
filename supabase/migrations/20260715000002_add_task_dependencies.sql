-- Create task_dependencies table if not exists
create table if not exists task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  blocked_task_id uuid not null references tasks(id) on delete cascade,
  blocking_task_id uuid not null references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  
  -- Prevent self-dependencies
  constraint check_not_self_dependency check (blocked_task_id <> blocking_task_id),
  -- Unique pair constraint
  constraint unique_task_dependency_pair unique (blocked_task_id, blocking_task_id)
);

-- Enable RLS
alter table task_dependencies enable row level security;

-- Policies for task_dependencies
create policy "task_dependencies_select" on task_dependencies
  for select using (
    exists (
      select 1 from projects p
      where p.id = task_dependencies.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "task_dependencies_insert" on task_dependencies
  for insert with check (
    exists (
      select 1 from projects p
      where p.id = task_dependencies.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "task_dependencies_delete" on task_dependencies
  for delete using (
    exists (
      select 1 from projects p
      where p.id = task_dependencies.project_id
      and p.user_id = auth.uid()::text
    )
  );

-- Indexes for performance
create index if not exists task_dependencies_project_id_idx on task_dependencies(project_id);
create index if not exists task_dependencies_blocked_task_id_idx on task_dependencies(blocked_task_id);
create index if not exists task_dependencies_blocking_task_id_idx on task_dependencies(blocking_task_id);
