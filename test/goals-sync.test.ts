/**
 * Integration tests for /api/goals/sync endpoint (#947)
 *
 * Covers:
 * - 401 when no session
 * - 404 when user not found in DB
 * - Fetches commit count from GitHub Search API with correct date range
 * - Updates all commit-based goals with the fetched count
 * - Handles GitHub API 429 — returns 429, does not update goals
 * - Handles Supabase update failure gracefully
 * - PR goals are synced using GitHub Issues Search API
 * - Returns updated count correctly
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────

import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { POST } from "@/app/api/goals/sync/route";

// ── Helpers ───────────────────────────────────────────────────────────────

const mockSession = {
  accessToken: "gh_test_token",
  githubId: "12345",
  githubLogin: "testuser",
};

const mockUser = { id: "user-uuid-1" };

const makeCommitGoal = (overrides = {}) => ({
  id: "goal-commit-1",
  unit: "commits",
  repo: null,
  repository: null,
  repo_name: null,
  ...overrides,
});

const makePRGoal = (overrides = {}) => ({
  id: "goal-pr-1",
  unit: "prs",
  repo: null,
  repository: null,
  repo_name: null,
  ...overrides,
});

/**
 * Builds a minimal Supabase chain mock.
 * Each call to supabaseAdmin.from() returns a builder whose
 * terminal method resolves to { data, error }.
 */
function mockSupabaseChain(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  // Make the chain also resolve as a promise (for non-.single() calls)
  (chain as any).then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data, error }).then(resolve);
    .catch(err => console.error(err))