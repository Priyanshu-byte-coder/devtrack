-- Add customizable category tags to goals (e.g. Side Project, Work, DSA, Open Source)
alter table goals
  add column if not exists category text
  check (category is null or category in ('side-project', 'work', 'dsa', 'open-source'));

create index if not exists goals_user_category on goals(user_id, category);
