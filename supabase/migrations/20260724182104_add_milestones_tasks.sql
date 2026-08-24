create table if not exists tasks (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  title        text not null,
  completed    boolean not null default false,
  milestone_id text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

drop table if exists milestones cascade;

create table milestones (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  name         text not null,
  description  text,
  due_date     timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table tasks add constraint fk_tasks_milestone
  foreign key (milestone_id) references milestones(id) on delete set null;

create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists milestones_user_id_idx on milestones(user_id);
create index if not exists tasks_milestone_id_idx on tasks(milestone_id);

alter table tasks enable row level security;
alter table milestones enable row level security;

create policy "tasks_select_own"
  on tasks for select
  using (user_id = auth.uid()::text);

create policy "tasks_insert_own"
  on tasks for insert
  with check (user_id = auth.uid()::text);

create policy "tasks_update_own"
  on tasks for update
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy "tasks_delete_own"
  on tasks for delete
  using (user_id = auth.uid()::text);

create policy "milestones_select_own"
  on milestones for select
  using (user_id = auth.uid()::text);

create policy "milestones_insert_own"
  on milestones for insert
  with check (user_id = auth.uid()::text);

create policy "milestones_update_own"
  on milestones for update
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy "milestones_delete_own"
  on milestones for delete
  using (user_id = auth.uid()::text);
