create table if not exists devtrack_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  name text not null,
  key text not null check (char_length(key) >= 2 and char_length(key) <= 10),
  description text default '',
  enable_keyword_triggers boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, key)
);

alter table devtrack_projects enable row level security;

create policy "devtrack_projects_select_own"
  on devtrack_projects for select
  using (user_id = auth.uid()::text);

create policy "devtrack_projects_insert_own"
  on devtrack_projects for insert
  with check (user_id = auth.uid()::text);

create policy "devtrack_projects_update_own"
  on devtrack_projects for update
  using (user_id = auth.uid()::text);

create policy "devtrack_projects_delete_own"
  on devtrack_projects for delete
  using (user_id = auth.uid()::text);


create table if not exists devtrack_repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references devtrack_projects(id) on delete cascade,
  repo_url text not null,
  created_at timestamptz default now(),
  unique (project_id, repo_url)
);

alter table devtrack_repositories enable row level security;

create policy "devtrack_repositories_select_own"
  on devtrack_repositories for select
  using (exists (
    select 1 from devtrack_projects p
    where p.id = project_id and p.user_id = auth.uid()::text
  ));

create policy "devtrack_repositories_insert_own"
  on devtrack_repositories for insert
  with check (exists (
    select 1 from devtrack_projects p
    where p.id = project_id and p.user_id = auth.uid()::text
  ));

create policy "devtrack_repositories_delete_own"
  on devtrack_repositories for delete
  using (exists (
    select 1 from devtrack_projects p
    where p.id = project_id and p.user_id = auth.uid()::text
  ));


create table if not exists devtrack_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references devtrack_projects(id) on delete cascade,
  issue_number integer not null,
  title text not null,
  description text default '',
  status text not null default 'Todo' check (status in ('Backlog', 'Todo', 'In Progress', 'In Review', 'Done')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, issue_number)
);

alter table devtrack_issues enable row level security;

create policy "devtrack_issues_select_own"
  on devtrack_issues for select
  using (exists (
    select 1 from devtrack_projects p
    where p.id = project_id and p.user_id = auth.uid()::text
  ));

create policy "devtrack_issues_insert_own"
  on devtrack_issues for insert
  with check (exists (
    select 1 from devtrack_projects p
    where p.id = project_id and p.user_id = auth.uid()::text
  ));

create policy "devtrack_issues_update_own"
  on devtrack_issues for update
  using (exists (
    select 1 from devtrack_projects p
    where p.id = project_id and p.user_id = auth.uid()::text
  ));

create policy "devtrack_issues_delete_own"
  on devtrack_issues for delete
  using (exists (
    select 1 from devtrack_projects p
    where p.id = project_id and p.user_id = auth.uid()::text
  ));


create table if not exists devtrack_issue_activities (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references devtrack_issues(id) on delete cascade,
  type text not null check (type in ('comment', 'commit_link', 'status_change')),
  content text not null,
  commit_hash text,
  commit_url text,
  author_name text,
  created_at timestamptz default now()
);

alter table devtrack_issue_activities enable row level security;

create policy "devtrack_issue_activities_select_own"
  on devtrack_issue_activities for select
  using (exists (
    select 1 from devtrack_issues i
    join devtrack_projects p on i.project_id = p.id
    where i.id = issue_id and p.user_id = auth.uid()::text
  ));

create policy "devtrack_issue_activities_insert_own"
  on devtrack_issue_activities for insert
  with check (exists (
    select 1 from devtrack_issues i
    join devtrack_projects p on i.project_id = p.id
    where i.id = issue_id and p.user_id = auth.uid()::text
  ));

create policy "devtrack_issue_activities_delete_own"
  on devtrack_issue_activities for delete
  using (exists (
    select 1 from devtrack_issues i
    join devtrack_projects p on i.project_id = p.id
    where i.id = issue_id and p.user_id = auth.uid()::text
  ));


-- Trigger function to auto-assign issue_number per project
create or replace function set_devtrack_issue_number()
returns trigger as $$
begin
  select coalesce(max(issue_number), 0) + 1
  into new.issue_number
  from devtrack_issues
  where project_id = new.project_id;
  return new;
end;
$$ language plpgsql;

create or replace trigger trigger_set_devtrack_issue_number
before insert on devtrack_issues
for each row
execute function set_devtrack_issue_number();
