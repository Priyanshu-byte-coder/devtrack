-- Migration: Add RLS policies for webhook tables
-- Created: 2026-05-20
-- Description: Enables RLS and adds policies for webhook_configs and webhook_deliveries tables.

-- ============================================================
-- WEBHOOK_CONFIGS TABLE
-- ============================================================
alter table webhook_configs enable row level security;

create policy "webhook_configs_select_own"
  on webhook_configs for select
  using (user_id = auth.uid()::text);

create policy "webhook_configs_insert_own"
  on webhook_configs for insert
  with check (user_id = auth.uid()::text);

create policy "webhook_configs_update_own"
  on webhook_configs for update
  using (user_id = auth.uid()::text);

create policy "webhook_configs_delete_own"
  on webhook_configs for delete
  using (user_id = auth.uid()::text);

-- ============================================================
-- WEBHOOK_DELIVERIES TABLE
-- ============================================================
alter table webhook_deliveries enable row level security;

create policy "webhook_deliveries_select_own"
  on webhook_deliveries for select
  using (
    webhook_id in (
      select id from webhook_configs where user_id = auth.uid()::text
    )
  );

create policy "webhook_deliveries_insert_own"
  on webhook_deliveries for insert
  with check (
    webhook_id in (
      select id from webhook_configs where user_id = auth.uid()::text
    )
  );
