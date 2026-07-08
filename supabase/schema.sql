create table if not exists users (
  id           text primary key default gen_random_uuid()::text,
  github_id    text unique not null,
  github_login text not null,
  webhook_url  text,
  bio          text default '' check (char_length(bio) <= 500),
  is_public    boolean default false,
  public_since timestamptz,
  show_weekly_goals boolean default false,
  leaderboard_opt_in boolean default false,
  pinned_repos text[] default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  wakatime_api_key_encrypted text,
  wakatime_api_key_iv text,
  is_sponsor   boolean default false,
  discord_webhook_url text,
  timezone text default 'UTC',
  last_discord_notification_at timestamptz,
  organizations_config jsonb default '{}'::jsonb,
  last_ai_summary_at timestamptz
);

alter table users
add column if not exists dashboard_layout jsonb not null default
'{
  "version": 1,
  "sections": ["overview", "activity", "analytics", "goals"],
  "widgets": {
    "overview": ["weekly-summary", "personal-records", "ai-mentor"],
    "activity": ["contribution-graph", "contribution-heatmap", "repo-contribution-distribution", "activity-ring", "coding-activity-insights", "streak-tracker", "local-coding-time", "coding-time", "commit-time", "productive-hours"],
    "analytics": ["repo-analytics", "pr-metrics", "pr-breakdown", "pr-review-trend", "discussions", "community-metrics", "pinned-repos", "top-repos", "inactive-repos"],
    "goals": ["issue-metrics", "goal-tracker", "daily-note", "recent-activity", "ci-analytics", "language-breakdown", "friend-comparison"]
  },
  "hidden": []
}'::jsonb;

CREATE INDEX IF NOT EXISTS users_leaderboard_opt_in_idx
  ON users(leaderboard_opt_in)
  WHERE leaderboard_opt_in = true;

create table if not exists goals (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  title        text not null,
  target       integer not null,
  current      integer not null default 0,
  unit         text not null default 'commits',
  deadline     timestamptz,
  recurrence   text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly')),
  period_start timestamptz default now(),
  last_synced_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  week_start   date
);
create index if not exists goals_user_period on goals(user_id, period_start);

create table if not exists goal_history (
  id           text primary key default gen_random_uuid()::text,
  goal_id      text not null references goals(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  period_start timestamptz not null,
  period_end   timestamptz not null,
  target       integer not null,
  achieved     integer not null default 0,
  completed    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(goal_id, period_start)
);
create index if not exists goal_history_user_period
  on goal_history(user_id, period_end desc);
create index if not exists goal_history_goal_period
  on goal_history(goal_id, period_end desc);
alter table goal_history enable row level security;
drop policy if exists "goal_history_select_own" on goal_history;
create policy "goal_history_select_own"
  on goal_history for select
  using (user_id = auth.uid()::text);
drop policy if exists "goal_history_insert_own" on goal_history;
create policy "goal_history_insert_own"
  on goal_history for insert
  with check (user_id = auth.uid()::text);
drop policy if exists "goal_history_delete_own" on goal_history;
create policy "goal_history_delete_own"
  on goal_history for delete
  using (user_id = auth.uid()::text);

create table if not exists metric_snapshots (
  id            text primary key default gen_random_uuid()::text,
  user_id       text not null references users(id) on delete cascade,
  snapshot_at   timestamptz default now(),
  commits       integer not null default 0,
  prs_open      integer not null default 0,
  prs_merged    integer not null default 0,
  issues_closed integer not null default 0
);
create index if not exists snapshots_user_time on metric_snapshots(user_id, snapshot_at);

create table if not exists user_github_accounts (
  id                     text primary key default gen_random_uuid()::text,
  user_id                text not null references users(id) on delete cascade,
  github_id              text not null,
  github_login           text not null,
  access_token_encrypted text not null,
  access_token_iv        text not null,
  added_at               timestamptz default now(),
  unique (user_id, github_id)
);
create index if not exists user_github_accounts_user_id_idx
  on user_github_accounts(user_id);

create table if not exists streak_freezes (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null references users(id) on delete cascade,
  freeze_date date not null,
  created_at  timestamptz default now()
);
create index if not exists streak_freezes_user on streak_freezes(user_id);
create unique index if not exists streak_freezes_user_date_uniq
  on streak_freezes(user_id, freeze_date);

create table if not exists notifications (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  type       text not null,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_time
  on notifications(user_id, created_at desc);

create table if not exists local_coding_sessions (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  date         date not null,
  total_seconds integer not null default 0,
  file_count   integer not null default 0,
  project_count integer not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(user_id, date)
);
create index if not exists local_coding_sessions_user_date on local_coding_sessions(user_id, date);

create table if not exists local_coding_api_keys (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  api_key      text not null unique,
  name         text not null,
  last_used_at  timestamptz,
  api_key_hash text unique,
  created_at   timestamptz default now()
);
create index if not exists local_coding_api_keys_user on local_coding_api_keys(user_id);
create index if not exists local_coding_api_keys_key on local_coding_api_keys(api_key);

create table if not exists ai_insights (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null,
  insight_type text not null check (insight_type in ('weekly_summary', 'pattern', 'recommendation', 'personality', 'goal_suggestions')),
  content      jsonb not null,
  generated_at timestamptz default now(),
  expires_at   timestamptz default now() + interval '24 hours'
);
create index if not exists idx_ai_insights_user_id on ai_insights(user_id);
create index if not exists idx_ai_insights_type    on ai_insights(insight_type);
create unique index if not exists idx_ai_insights_user_type
  on ai_insights(user_id, insight_type);

create table if not exists daily_notes (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               text not null,
  date                  date not null,
  note                  text,
  created_at            timestamptz default now(),
  UNIQUE(user_id, date)
);

create table if not exists user_github_achievements (
  user_id      text primary key references users(id) on delete cascade,
  github_login text not null,
  achievements jsonb not null default '[]'::jsonb,
  synced_at    timestamptz,
  fetch_error  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_user_github_achievements_login
  on user_github_achievements(github_login);
alter table user_github_achievements enable row level security;
drop policy if exists "user_github_achievements_select_own" on user_github_achievements;
create policy "user_github_achievements_select_own"
  on user_github_achievements for select
  using (user_id = auth.uid()::text);

create table if not exists jira_credentials (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null unique references users(id) on delete cascade,
  jira_domain  text not null,
  email        text not null,
  api_token    text not null,
  token_iv     text not null,
  project_key  text,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists jira_credentials_user on jira_credentials(user_id);

create or replace function batch_upsert_sessions(sessions jsonb)
returns void as $$
declare
  session_record jsonb;
begin
  for session_record in select * from jsonb_array_elements(sessions) loop
    insert into local_coding_sessions (user_id, date, total_seconds, file_count, project_count)
    values (
      (session_record->>'user_id'),
      (session_record->>'date')::date,
      (session_record->>'total_seconds')::integer,
      coalesce((session_record->>'file_count')::integer, 0),
      coalesce((session_record->>'project_count')::integer, 0)
    )
    on conflict (user_id, date) do update set
      total_seconds = excluded.total_seconds,
      file_count = excluded.file_count,
      project_count = excluded.project_count,
      updated_at = now();
  end loop;
end;
$$ language plpgsql security definer;

CREATE TABLE IF NOT EXISTS collaboration_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_full_name TEXT GENERATED ALWAYS AS (repo_owner || '/' || repo_name) STORED,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_owner, repo_name, created_by)
);
CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, github_username)
);
CREATE TABLE IF NOT EXISTS room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  sender_username TEXT NOT NULL,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE collaboration_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_select" ON collaboration_rooms;
CREATE POLICY "room_select" ON collaboration_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = id AND github_username = current_setting('request.jwt.claims', true)::json->>'login'
    )
  );
DROP POLICY IF EXISTS "message_select" ON room_messages;
CREATE POLICY "message_select" ON room_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_messages.room_id
        AND github_username = current_setting('request.jwt.claims', true)::json->>'login'
    )
  );
DROP POLICY IF EXISTS "message_insert" ON room_messages;
CREATE POLICY "message_insert" ON room_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_messages.room_id
        AND github_username = current_setting('request.jwt.claims', true)::json->>'login'
    )
  );
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  key text primary key,
  payload jsonb,
  generated_at timestamptz,
  expires_at timestamptz,
  building_until timestamptz,
  updated_at timestamptz default now()
);
);

-- -------------------------------------------------------
-- User Sponsor Metrics: cache for user-specific GitHub Sponsors data
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sponsor_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  mrr INTEGER NOT NULL DEFAULT 0,
  active_count INTEGER NOT NULL DEFAULT 0,
  growth_trend DOUBLE PRECISION NOT NULL DEFAULT 0,
  sparkline_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  sponsors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_sponsor_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sponsor metrics"
  ON user_sponsor_metrics FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own sponsor metrics"
  ON user_sponsor_metrics FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own sponsor metrics"
  ON user_sponsor_metrics FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own sponsor metrics"
  ON user_sponsor_metrics FOR DELETE
  USING (auth.uid()::text = user_id);

