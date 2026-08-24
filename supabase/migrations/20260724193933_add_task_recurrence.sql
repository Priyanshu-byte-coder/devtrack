alter table tasks
add column if not exists recurrence_config jsonb,
add column if not exists recurrence_count integer not null default 0;
