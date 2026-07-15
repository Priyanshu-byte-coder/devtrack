-- Add notification_preferences column to users if not exists
alter table users 
add column if not exists notification_preferences jsonb not null default 
'{"task_assigned": {"email": true, "in_app": true}, "blocker_added": {"email": true, "in_app": true}, "weekly_summary": {"email": true, "in_app": false}}'::jsonb;
