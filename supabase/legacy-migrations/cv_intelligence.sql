-- Migration: AI-Powered Contribution Intelligence & CV Generator
-- Creates tables for caching contribution analyses and generated resume content.

-- ============================================================
-- Table: cv_analyses
-- Stores cached GitHub contribution analyses per user (24h TTL)
-- ============================================================
CREATE TABLE IF NOT EXISTS cv_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT cv_analyses_user_id_unique UNIQUE (user_id)
);

-- Index for TTL-based cache lookups
CREATE INDEX IF NOT EXISTS idx_cv_analyses_user_expires
  ON cv_analyses (user_id, expires_at DESC);

-- RLS: users can only read/write their own analyses
ALTER TABLE cv_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cv_analyses"
  ON cv_analyses FOR SELECT
  USING (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can insert own cv_analyses"
  ON cv_analyses FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can update own cv_analyses"
  ON cv_analyses FOR UPDATE
  USING (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can delete own cv_analyses"
  ON cv_analyses FOR DELETE
  USING (user_id = current_setting('request.jwt.claim.sub', true));

-- Service role bypass (for server-side operations)
CREATE POLICY "Service role full access on cv_analyses"
  ON cv_analyses FOR ALL
  USING (current_setting('role', true) = 'service_role');


-- ============================================================
-- Table: cv_generated_content
-- Stores generated resume content per user per role
-- ============================================================
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

-- Index for user + role lookups
CREATE INDEX IF NOT EXISTS idx_cv_generated_content_user_role
  ON cv_generated_content (user_id, role);

-- RLS: users can only read/write their own generated content
ALTER TABLE cv_generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cv_generated_content"
  ON cv_generated_content FOR SELECT
  USING (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can insert own cv_generated_content"
  ON cv_generated_content FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can update own cv_generated_content"
  ON cv_generated_content FOR UPDATE
  USING (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can delete own cv_generated_content"
  ON cv_generated_content FOR DELETE
  USING (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Service role full access on cv_generated_content"
  ON cv_generated_content FOR ALL
  USING (current_setting('role', true) = 'service_role');
