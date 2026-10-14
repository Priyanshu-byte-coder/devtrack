-- Canonical DevTrack schema. Safe to replay; browser access uses authenticated server APIs.
-- Historical migrations are retained in legacy-migrations for provenance.


-- Upgrade known UUID/numeric/date variants while preserving historical rows.
DO $upgrade$
DECLARE r record; invalid_counts boolean;
BEGIN
  FOR r IN SELECT table_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('users','goals') AND column_name='id'
  LOOP
    IF r.data_type <> 'text' THEN RAISE EXCEPTION 'Unsupported %.id type %. Map identities before adopting the canonical schema.', r.table_name, r.data_type; END IF;
  END LOOP;
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('goal_history','milestones')
      AND column_name IN ('id','user_id','goal_id') AND data_type='uuid'
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.contype='f' AND c.conrelid=to_regclass('public.'||r.table_name) AND a.attname=r.column_name)
    THEN RAISE EXCEPTION 'Inspect legacy foreign keys on %.% before converting identities.', r.table_name, r.column_name; END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT',r.table_name,r.column_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text USING %I::text',r.table_name,r.column_name,r.column_name);
    IF r.column_name='id' THEN EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid()::text',r.table_name); END IF;
  END LOOP;
  IF to_regclass('public.goal_history') IS NOT NULL THEN
    FOR r IN SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='goal_history' AND column_name IN ('target','achieved','period_start','period_end')
    LOOP
      IF r.data_type='numeric' THEN
        EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.goal_history WHERE %I <> trunc(%I) OR %I > 2147483647 OR %I < -2147483648)',r.column_name,r.column_name,r.column_name,r.column_name) INTO invalid_counts;
        IF invalid_counts THEN RAISE EXCEPTION 'Legacy goal history contains non-integer/out-of-range counts. Reconcile them before migration.'; END IF;
        EXECUTE format('ALTER TABLE public.goal_history ALTER COLUMN %I TYPE integer USING %I::integer',r.column_name,r.column_name);
      ELSIF r.data_type='date' THEN EXECUTE format('ALTER TABLE public.goal_history ALTER COLUMN %I TYPE timestamptz USING %I::timestamp AT TIME ZONE ''UTC''',r.column_name,r.column_name); END IF;
    END LOOP;
  END IF;
END $upgrade$;

CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS goals (
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
  week_start   date,
  category     text check (category is null or category in ('side-project', 'work', 'dsa', 'open-source'))
);

CREATE TABLE IF NOT EXISTS goal_history (
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

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id            text primary key default gen_random_uuid()::text,
  user_id       text not null references users(id) on delete cascade,
  snapshot_at   timestamptz default now(),
  commits       integer not null default 0,
  prs_open      integer not null default 0,
  prs_merged    integer not null default 0,
  issues_closed integer not null default 0
);

CREATE TABLE IF NOT EXISTS user_github_accounts (
  id                     text primary key default gen_random_uuid()::text,
  user_id                text not null references users(id) on delete cascade,
  github_id              text not null,
  github_login           text not null,
  access_token_encrypted text not null,
  access_token_iv        text not null,
  added_at               timestamptz default now(),
  unique (user_id, github_id)
);

CREATE TABLE IF NOT EXISTS streak_freezes (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null references users(id) on delete cascade,
  freeze_date date not null,
  created_at  timestamptz default now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  type       text not null,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS local_coding_sessions (
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

CREATE TABLE IF NOT EXISTS local_coding_api_keys (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  api_key      text not null unique,
  name         text not null,
  last_used_at  timestamptz,
  api_key_hash text unique,
  created_at   timestamptz default now()
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null,
  insight_type text not null check (insight_type in ('weekly_summary', 'pattern', 'recommendation')),
  content      jsonb not null,
  generated_at timestamptz default now(),
  expires_at   timestamptz default now() + interval '24 hours'
);

CREATE TABLE IF NOT EXISTS daily_notes (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               text not null,
  date                  date not null,
  note                  text,
  created_at            timestamptz default now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS user_github_achievements (
  user_id      text primary key references users(id) on delete cascade,
  github_login text not null,
  achievements jsonb not null default '[]'::jsonb,
  synced_at    timestamptz,
  fetch_error  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

CREATE TABLE IF NOT EXISTS jira_credentials (
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

CREATE TABLE IF NOT EXISTS room_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(room_id, github_username, status)
);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  key text primary key,
  payload jsonb,
  generated_at timestamptz,
  expires_at timestamptz,
  building_until timestamptz,
  updated_at timestamptz default now()
);

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

CREATE TABLE IF NOT EXISTS wakatime_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS webhook_configs (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  name         text not null,
  url          text not null,
  events       text[] not null default '{}',
  secret_key   text not null,
  secret_iv    text,
  is_enabled   boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            text primary key default gen_random_uuid()::text,
  webhook_id    text not null references webhook_configs(id) on delete cascade,
  event         text not null,
  payload       jsonb not null,
  status_code   integer,
  success       boolean default false,
  error_message text,
  delivered_at  timestamptz default now()
);

CREATE TABLE IF NOT EXISTS streak_milestones (
  id           text primary key default gen_random_uuid()::text,
  user_id      text not null references users(id) on delete cascade,
  streak_count integer not null,
  achieved_at  timestamptz default now(),
  unique(user_id, streak_count)
);

CREATE TABLE IF NOT EXISTS data_export_audit (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null references users(id) on delete cascade,


  action      text        not null check (action in ('export', 'delete')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS daily_focus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  goal_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_github_orgs (
  id                 text        primary key default gen_random_uuid()::text,
  user_id            text        not null references users(id) on delete cascade,
  org_login          text        not null,
  org_id             text        not null,
  avatar_url         text,
  include_in_metrics boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS devtrack_badges (
  user_id text references users(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS milestones (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  title text not null,
  description text not null default '',
  target_value integer not null check (target_value >= 1),
  current_value integer not null default 0 check (current_value >= 0),
  unit text not null default 'units',
  target_date date not null,
  category text not null default 'custom' check (category in ('commits', 'streak', 'projects', 'custom')),
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS user_tokens (
  user_id         text primary key references users(id) on delete cascade,
  encrypted_token text not null,
  token_iv        text not null,
  updated_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS cv_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT cv_analyses_user_id_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS cv_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT cv_generated_content_user_role_unique UNIQUE (user_id, role)
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

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

alter table users
  add column if not exists pinned_repos text[] not null default '{}';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS seen_onboarding BOOLEAN DEFAULT FALSE;

alter table webhook_configs
  add column if not exists secret_iv text;

alter table local_coding_api_keys add column if not exists api_key_hash text unique;

alter table goals
  add column if not exists unit text not null default 'commits',
  add column if not exists last_synced_at timestamptz;

ALTER TABLE users ADD COLUMN IF NOT EXISTS wakatime_api_key_encrypted text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS wakatime_api_key_iv text;

alter table if exists users
  add column if not exists webhook_url text;

ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline timestamptz;

ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_digest_opt_in BOOLEAN DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

alter table users
  add column if not exists bio text default '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sponsor BOOLEAN DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS last_discord_notification_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS discord_muted_until TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS organizations_config jsonb DEFAULT '{}'::jsonb;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS public_since timestamptz;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS show_weekly_goals boolean NOT NULL DEFAULT false;

alter table public.goals
  add column if not exists is_public boolean not null default false;

ALTER TABLE goals
ADD COLUMN IF NOT EXISTS goal_reset_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_ai_summary_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_locale text DEFAULT 'en'
CHECK (preferred_locale IN ('en', 'es'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_widgets jsonb NOT NULL DEFAULT '["streak","contributions"]'::jsonb;

alter table goals
  add column if not exists category text
  check (category is null or category in ('side-project', 'work', 'dsa', 'open-source'));

CREATE INDEX IF NOT EXISTS users_leaderboard_opt_in_idx
  ON users(leaderboard_opt_in)
  WHERE leaderboard_opt_in = true;

create index IF NOT EXISTS goals_user_period on goals(user_id, period_start);

create index IF NOT EXISTS goals_user_category on goals(user_id, category);

create index IF NOT EXISTS goal_history_user_period
  on goal_history(user_id, period_end desc);

create index IF NOT EXISTS goal_history_goal_period
  on goal_history(goal_id, period_end desc);

create index IF NOT EXISTS snapshots_user_time on metric_snapshots(user_id, snapshot_at);

create index IF NOT EXISTS user_github_accounts_user_id_idx
  on user_github_accounts(user_id);

create index IF NOT EXISTS streak_freezes_user on streak_freezes(user_id);

create unique index IF NOT EXISTS streak_freezes_user_date_uniq
  on streak_freezes(user_id, freeze_date);

create index IF NOT EXISTS notifications_user_time
  on notifications(user_id, created_at desc);

create index IF NOT EXISTS local_coding_sessions_user_date on local_coding_sessions(user_id, date);

create index IF NOT EXISTS local_coding_api_keys_user on local_coding_api_keys(user_id);

create index IF NOT EXISTS local_coding_api_keys_key on local_coding_api_keys(api_key);

create index IF NOT EXISTS idx_ai_insights_user_id on ai_insights(user_id);

create index IF NOT EXISTS idx_ai_insights_type    on ai_insights(insight_type);

create unique index IF NOT EXISTS idx_ai_insights_user_type
  on ai_insights(user_id, insight_type);

create index IF NOT EXISTS idx_user_github_achievements_login
  on user_github_achievements(github_login);

create index IF NOT EXISTS jira_credentials_user on jira_credentials(user_id);

CREATE INDEX IF NOT EXISTS room_invitations_invitee_idx
  ON room_invitations(github_username, status);

CREATE INDEX IF NOT EXISTS users_is_public_idx ON users(is_public);

create index IF NOT EXISTS webhook_configs_user on webhook_configs(user_id);

create index IF NOT EXISTS webhook_deliveries_webhook on webhook_deliveries(webhook_id);

create index IF NOT EXISTS webhook_deliveries_time on webhook_deliveries(delivered_at);

create index IF NOT EXISTS streak_milestones_user on streak_milestones(user_id);

create index IF NOT EXISTS local_coding_api_keys_key_hash on local_coding_api_keys(api_key_hash);

create index IF NOT EXISTS data_export_audit_user_action_time
  on data_export_audit (user_id, action, created_at desc);

CREATE INDEX IF NOT EXISTS users_last_digest_sent_at_idx
  ON users (last_digest_sent_at);

create index IF NOT EXISTS user_github_orgs_user_id
  on user_github_orgs (user_id);

CREATE INDEX IF NOT EXISTS users_public_since_idx ON users(public_since);

create index IF NOT EXISTS goals_public_share_lookup_idx
  on public.goals (user_id, id)
  where is_public = true;

CREATE INDEX IF NOT EXISTS users_last_ai_summary_at_idx
  ON users (id, last_ai_summary_at)
  WHERE last_ai_summary_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cv_analyses_user_expires
  ON cv_analyses (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_cv_generated_content_user_role
  ON cv_generated_content (user_id, role);

ALTER TABLE goals ADD COLUMN IF NOT EXISTS repo text;

ALTER TABLE room_members ADD COLUMN IF NOT EXISTS github_id text;

ALTER TABLE room_invitations ADD COLUMN IF NOT EXISTS github_id text;

CREATE UNIQUE INDEX IF NOT EXISTS room_members_stable_identity ON room_members(room_id, github_id);

CREATE UNIQUE INDEX IF NOT EXISTS room_invitations_stable_pending ON room_invitations(room_id, github_id) WHERE status = 'pending';

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
$$ language plpgsql security definer SET search_path = public;

CREATE OR REPLACE VIEW linked_accounts WITH (security_invoker = true) AS SELECT id, user_id, github_id, github_login, access_token_encrypted, access_token_iv, added_at FROM user_github_accounts;

CREATE OR REPLACE FUNCTION respond_to_room_invitation(p_invitation_id uuid, p_github_id text, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invitation room_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM room_invitations WHERE id = p_invitation_id AND github_id = p_github_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_accept THEN
    INSERT INTO room_members(room_id, github_username, github_id, role)
    VALUES (invitation.room_id, invitation.github_username, p_github_id, 'member')
    ON CONFLICT (room_id, github_id) DO NOTHING;
  END IF;
  UPDATE room_invitations SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now() WHERE id = p_invitation_id;
  RETURN jsonb_build_object('status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
END;
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE users FROM anon, authenticated;

GRANT ALL ON TABLE users TO service_role;

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE goals FROM anon, authenticated;

GRANT ALL ON TABLE goals TO service_role;

ALTER TABLE goal_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE goal_history FROM anon, authenticated;

GRANT ALL ON TABLE goal_history TO service_role;

ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE metric_snapshots FROM anon, authenticated;

GRANT ALL ON TABLE metric_snapshots TO service_role;

ALTER TABLE user_github_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_github_accounts FROM anon, authenticated;

GRANT ALL ON TABLE user_github_accounts TO service_role;

ALTER TABLE streak_freezes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE streak_freezes FROM anon, authenticated;

GRANT ALL ON TABLE streak_freezes TO service_role;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE notifications FROM anon, authenticated;

GRANT ALL ON TABLE notifications TO service_role;

ALTER TABLE local_coding_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE local_coding_sessions FROM anon, authenticated;

GRANT ALL ON TABLE local_coding_sessions TO service_role;

ALTER TABLE local_coding_api_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE local_coding_api_keys FROM anon, authenticated;

GRANT ALL ON TABLE local_coding_api_keys TO service_role;

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ai_insights FROM anon, authenticated;

GRANT ALL ON TABLE ai_insights TO service_role;

ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE daily_notes FROM anon, authenticated;

GRANT ALL ON TABLE daily_notes TO service_role;

ALTER TABLE user_github_achievements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_github_achievements FROM anon, authenticated;

GRANT ALL ON TABLE user_github_achievements TO service_role;

ALTER TABLE jira_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE jira_credentials FROM anon, authenticated;

GRANT ALL ON TABLE jira_credentials TO service_role;

ALTER TABLE collaboration_rooms ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE collaboration_rooms FROM anon, authenticated;

GRANT ALL ON TABLE collaboration_rooms TO service_role;

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE room_members FROM anon, authenticated;

GRANT ALL ON TABLE room_members TO service_role;

ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE room_messages FROM anon, authenticated;

GRANT ALL ON TABLE room_messages TO service_role;

ALTER TABLE room_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE room_invitations FROM anon, authenticated;

GRANT ALL ON TABLE room_invitations TO service_role;

ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE leaderboard_cache FROM anon, authenticated;

GRANT ALL ON TABLE leaderboard_cache TO service_role;

ALTER TABLE user_sponsor_metrics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_sponsor_metrics FROM anon, authenticated;

GRANT ALL ON TABLE user_sponsor_metrics TO service_role;

ALTER TABLE wakatime_stats ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE wakatime_stats FROM anon, authenticated;

GRANT ALL ON TABLE wakatime_stats TO service_role;

ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE webhook_configs FROM anon, authenticated;

GRANT ALL ON TABLE webhook_configs TO service_role;

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE webhook_deliveries FROM anon, authenticated;

GRANT ALL ON TABLE webhook_deliveries TO service_role;

ALTER TABLE streak_milestones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE streak_milestones FROM anon, authenticated;

GRANT ALL ON TABLE streak_milestones TO service_role;

ALTER TABLE data_export_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE data_export_audit FROM anon, authenticated;

GRANT ALL ON TABLE data_export_audit TO service_role;

ALTER TABLE daily_focus ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE daily_focus FROM anon, authenticated;

GRANT ALL ON TABLE daily_focus TO service_role;

ALTER TABLE user_github_orgs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_github_orgs FROM anon, authenticated;

GRANT ALL ON TABLE user_github_orgs TO service_role;

ALTER TABLE devtrack_badges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE devtrack_badges FROM anon, authenticated;

GRANT ALL ON TABLE devtrack_badges TO service_role;

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE milestones FROM anon, authenticated;

GRANT ALL ON TABLE milestones TO service_role;

ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_tokens FROM anon, authenticated;

GRANT ALL ON TABLE user_tokens TO service_role;

ALTER TABLE cv_analyses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE cv_analyses FROM anon, authenticated;

GRANT ALL ON TABLE cv_analyses TO service_role;

ALTER TABLE cv_generated_content ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE cv_generated_content FROM anon, authenticated;

GRANT ALL ON TABLE cv_generated_content TO service_role;

REVOKE ALL ON linked_accounts FROM anon, authenticated;

GRANT ALL ON linked_accounts TO service_role;

REVOKE ALL ON FUNCTION batch_upsert_sessions(jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION batch_upsert_sessions(jsonb) TO service_role;

REVOKE ALL ON FUNCTION respond_to_room_invitation(uuid,text,boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION respond_to_room_invitation(uuid,text,boolean) TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER TABLE webhook_configs ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'application/json';
CREATE UNIQUE INDEX IF NOT EXISTS daily_focus_user_id_date_key ON daily_focus(user_id,date);
-- New rows enforce referential integrity; old orphaned cache/notes rows are retained for review.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ai_insights','daily_notes','cv_analyses','cv_generated_content'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = table_name || '_user_id_fkey' AND conrelid = ('public.' || table_name)::regclass) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID', table_name, table_name || '_user_id_fkey');
    END IF;
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS cron_jobs (
  name text PRIMARY KEY,
  cursor text,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cron_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cron_jobs FROM anon, authenticated;
GRANT ALL ON cron_jobs TO service_role;
CREATE OR REPLACE FUNCTION claim_cron_job(p_name text, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE job cron_jobs%ROWTYPE;
BEGIN
  INSERT INTO cron_jobs(name) VALUES(p_name) ON CONFLICT DO NOTHING;
  SELECT * INTO job FROM cron_jobs WHERE name=p_name FOR UPDATE;
  IF job.lease_until > now() THEN RETURN NULL; END IF;
  UPDATE cron_jobs SET lease_token=p_token, lease_until=now()+interval '5 minutes', updated_at=now() WHERE name=p_name;
  RETURN jsonb_build_object('cursor', job.cursor);
END;
$$;
REVOKE ALL ON FUNCTION claim_cron_job(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_cron_job(text,uuid) TO service_role;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_weekly_webhook_at timestamptz;

-- Old goal-history variants did not have replay protection or compatible keys.
CREATE UNIQUE INDEX IF NOT EXISTS goal_history_goal_period_unique ON goal_history(goal_id, period_start);
DO $keys$
DECLARE table_name text; key_column text; parent_name text;
BEGIN
  FOR table_name,key_column,parent_name IN VALUES ('goal_history','user_id','users'),('goal_history','goal_id','goals'),('milestones','user_id','users')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.contype='f' AND c.conrelid=to_regclass('public.'||table_name) AND a.attname=key_column) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE NOT VALID',table_name,table_name||'_'||key_column||'_fkey',key_column,parent_name);
    END IF;
  END LOOP;
END $keys$;

-- Scheduled sync archives completed periods even when the dashboard is never opened.
CREATE OR REPLACE FUNCTION rollover_goals(p_user_id text, p_now timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE goal goals%ROWTYPE; next_start timestamptz;
BEGIN
  FOR goal IN SELECT * FROM goals WHERE user_id=p_user_id AND recurrence IN ('weekly','monthly') FOR UPDATE
  LOOP
    next_start := date_trunc(CASE WHEN goal.recurrence='weekly' THEN 'week' ELSE 'month' END, p_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    IF goal.period_start IS NULL OR goal.period_start < next_start THEN
      INSERT INTO goal_history(goal_id,user_id,period_start,period_end,target,achieved,completed)
        VALUES(goal.id,goal.user_id,coalesce(goal.period_start,'1970-01-01'::timestamptz),next_start-interval '1 millisecond',goal.target,goal.current,goal.current>=goal.target)
        ON CONFLICT(goal_id,period_start) DO NOTHING;
      UPDATE goals SET current=0,period_start=next_start,week_start=(next_start AT TIME ZONE 'UTC')::date,goal_reset_version=goal_reset_version+1 WHERE id=goal.id;
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION rollover_goals(text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rollover_goals(text,timestamptz) TO service_role;

-- Stable message authors support account cleanup without trusting recycled handles.
ALTER TABLE room_messages ADD COLUMN IF NOT EXISTS sender_github_id text;
CREATE OR REPLACE FUNCTION delete_app_user(p_user_id text, p_github_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM users WHERE id=p_user_id AND github_id=p_github_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM collaboration_rooms WHERE id IN (SELECT room_id FROM room_members WHERE github_id=p_github_id AND role='owner');
  DELETE FROM room_messages WHERE sender_github_id=p_github_id;
  DELETE FROM room_members WHERE github_id=p_github_id;
  DELETE FROM room_invitations WHERE github_id=p_github_id;
  DELETE FROM users WHERE id=p_user_id AND github_id=p_github_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION delete_app_user(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION delete_app_user(text,text) TO service_role;
