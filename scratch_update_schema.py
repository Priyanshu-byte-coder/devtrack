import sys

filepath = "supabase/schema.sql"
with open(filepath, "r") as f:
    content = f.read()

old_tasks = """create table if not exists tasks (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  title        text not null,
  completed    boolean not null default false,
  milestone_id text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);"""

new_tasks = """create table if not exists tasks (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  title        text not null,
  completed    boolean not null default false,
  status       text not null default 'todo',
  priority     text not null default 'medium',
  due_date     timestamptz,
  tags         text[] not null default '{}'::text[],
  milestone_id text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);"""

if old_tasks in content:
    content = content.replace(old_tasks, new_tasks)
    with open(filepath, "w") as f:
        f.write(content)
    print("Updated schema.sql successfully")
else:
    print("Could not find the target text in schema.sql")
