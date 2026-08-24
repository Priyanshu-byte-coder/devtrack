alter table tasks
add column if not exists order_index integer not null default 0;
