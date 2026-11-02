alter table webhook_configs
  add column if not exists secret_iv text;
