alter table tasks 
add column if not exists status text not null default 'todo',
add column if not exists priority text not null default 'medium',
add column if not exists due_date timestamptz,
add column if not exists tags text[] not null default '{}'::text[];

-- Migrate existing completed tasks to status
update tasks set status = 'done' where completed = true;

-- We can leave the `completed` column for now to avoid breaking existing code while we transition, 
-- or drop it. We'll leave it for backward compatibility and just keep it in sync or phase it out.
