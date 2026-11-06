-- Gamification persistence: rank history, personal progress, season results.
--
-- Additive only: three new tables, no changes to existing ones. Safe to run
-- more than once. Every table follows the baseline's access model: RLS on,
-- browser roles revoked, server-side access through the service role only.
-- Rows reference users(id) ON DELETE CASCADE, so delete_app_user removes them.

-- One row per user, per leaderboard period, per day. Rank deltas ("up 3 this
-- week") and season standings are read from here.
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  user_id      text not null references users(id) on delete cascade,
  period       text not null check (period in ('week', 'month', 'all')),
  captured_on  date not null,
  rank         integer not null check (rank > 0),
  score_v2     integer not null check (score_v2 between 0 and 1000),
  tier         text not null check (tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend')),
  streak       integer not null default 0 check (streak >= 0),
  commits      integer not null default 0 check (commits >= 0),
  prs          integer not null default 0 check (prs >= 0),
  reviews      integer not null default 0 check (reviews >= 0),
  active_days  integer not null default 0 check (active_days >= 0),
  repos        integer not null default 0 check (repos >= 0),
  created_at   timestamptz not null default now(),
  primary key (user_id, period, captured_on)
);

CREATE INDEX IF NOT EXISTS leaderboard_snapshots_period_day
  ON leaderboard_snapshots(period, captured_on);

-- Personal progress. XP and level only ever rise and best_rank only ever
-- improves; the trigger below enforces that, so a GitHub count that dips
-- (a deleted repository, say) can never take progress away.
CREATE TABLE IF NOT EXISTS user_progress (
  user_id     text primary key references users(id) on delete cascade,
  xp          bigint not null default 0 check (xp >= 0),
  level       integer not null default 1 check (level >= 1),
  tier        text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend')),
  best_tier   text not null default 'bronze' check (best_tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend')),
  best_rank   integer check (best_rank > 0),
  updated_at  timestamptz not null default now()
);

CREATE OR REPLACE FUNCTION user_progress_never_regress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tiers text[] := ARRAY['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'];
BEGIN
  NEW.xp := GREATEST(OLD.xp, NEW.xp);
  NEW.level := GREATEST(OLD.level, NEW.level);
  NEW.best_rank := CASE
    WHEN OLD.best_rank IS NULL THEN NEW.best_rank
    WHEN NEW.best_rank IS NULL THEN OLD.best_rank
    ELSE LEAST(OLD.best_rank, NEW.best_rank)
  END;
  IF array_position(tiers, OLD.best_tier) > array_position(tiers, NEW.best_tier) THEN
    NEW.best_tier := OLD.best_tier;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_progress_never_regress ON user_progress;
CREATE TRIGGER user_progress_never_regress
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION user_progress_never_regress();

-- Final standings for each monthly season ('YYYY-MM'), written once when the
-- month closes.
CREATE TABLE IF NOT EXISTS season_results (
  season        text not null check (season ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  user_id       text not null references users(id) on delete cascade,
  rank          integer not null check (rank > 0),
  score_v2      integer not null check (score_v2 between 0 and 1000),
  tier          text not null check (tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend')),
  finalized_at  timestamptz not null default now(),
  primary key (season, user_id)
);

CREATE INDEX IF NOT EXISTS season_results_user ON season_results(user_id);

ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE leaderboard_snapshots FROM anon, authenticated;
GRANT ALL ON TABLE leaderboard_snapshots TO service_role;

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_progress FROM anon, authenticated;
GRANT ALL ON TABLE user_progress TO service_role;

ALTER TABLE season_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE season_results FROM anon, authenticated;
GRANT ALL ON TABLE season_results TO service_role;

REVOKE ALL ON FUNCTION user_progress_never_regress() FROM PUBLIC, anon, authenticated;
