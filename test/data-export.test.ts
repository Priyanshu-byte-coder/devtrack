/**
 * Tests for GET /api/user/data-export
 *
 * Covers:
 *  - Authentication guard (401 without session, 404 for unknown user)
 *  - Rate limiting (429 on second request within window, pass after window)
 *  - JSON payload generation (correct MIME type, non-empty, expected fields)
 *  - Audit logging side effect
 *  - Security: secrets are excluded from exported data
 *  - Streak milestones database extraction and correct column schema check
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest("http://localhost/api/user/data-export");
  for (const [key, value] of Object.entries(headers)) {
    Object.defineProperty(req, "headers", {
      value: new Headers({ ...Object.fromEntries(req.headers.entries()), [key]: value }),
      configurable: true,
    });
  }
  return req;
}

/**
 * Builds a chainable Supabase query mock.
 * The final call in the chain resolves to `result`.
 */
function buildChain(result: unknown) {
  const chain: any = {
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
    .catch(err => console.error(err))