-- Add webhook_url column to users for notifications

alter table if exists users
  add column if not exists webhook_url text;
