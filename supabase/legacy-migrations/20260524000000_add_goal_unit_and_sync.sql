-- Migration: add unit and last_synced_at to goals
-- unit: 'commits' | 'prs' | 'hours' — only 'commits' triggers auto-progress
-- last_synced_at: set whenever the sync route updates this goal's current value

alter table goals
  add column if not exists unit text not null default 'commits',
  add column if not exists last_synced_at timestamptz;
