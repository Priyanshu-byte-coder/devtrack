-- Create projects table if not exists
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS on projects
alter table projects enable row level security;

-- Policies for projects
create policy "projects_select_own" on projects
  for select using (user_id = auth.uid()::text);

create policy "projects_insert_own" on projects
  for insert with check (user_id = auth.uid()::text);

create policy "projects_update_own" on projects
  for update using (user_id = auth.uid()::text);

create policy "projects_delete_own" on projects
  for delete using (user_id = auth.uid()::text);

-- Create indexes for projects
create index if not exists projects_user_id_idx on projects(user_id);


-- Create workflow_stages table if not exists
create table if not exists workflow_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  position integer not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- Enable RLS on workflow_stages
alter table workflow_stages enable row level security;

-- Policies for workflow_stages
create policy "workflow_stages_select" on workflow_stages
  for select using (
    exists (
      select 1 from projects p
      where p.id = workflow_stages.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "workflow_stages_insert" on workflow_stages
  for insert with check (
    exists (
      select 1 from projects p
      where p.id = workflow_stages.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "workflow_stages_update" on workflow_stages
  for update using (
    exists (
      select 1 from projects p
      where p.id = workflow_stages.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "workflow_stages_delete" on workflow_stages
  for delete using (
    exists (
      select 1 from projects p
      where p.id = workflow_stages.project_id
      and p.user_id = auth.uid()::text
    )
  );

-- Create indexes for workflow_stages
create index if not exists workflow_stages_project_id_idx on workflow_stages(project_id);


-- Create tasks table if not exists
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_id uuid not null references workflow_stages(id) on delete cascade,
  title text not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on tasks
alter table tasks enable row level security;

-- Policies for tasks
create policy "tasks_select" on tasks
  for select using (
    exists (
      select 1 from projects p
      where p.id = tasks.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "tasks_insert" on tasks
  for insert with check (
    exists (
      select 1 from projects p
      where p.id = tasks.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "tasks_update" on tasks
  for update using (
    exists (
      select 1 from projects p
      where p.id = tasks.project_id
      and p.user_id = auth.uid()::text
    )
  );

create policy "tasks_delete" on tasks
  for delete using (
    exists (
      select 1 from projects p
      where p.id = tasks.project_id
      and p.user_id = auth.uid()::text
    )
  );

-- Create indexes for tasks
create index if not exists tasks_project_id_idx on tasks(project_id);
create index if not exists tasks_stage_id_idx on tasks(stage_id);
