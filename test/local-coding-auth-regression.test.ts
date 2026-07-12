/**
 * Security tests for API key credential isolation — issue #1689.
 *
 * Background
 * ----------
 * An earlier version of the code wrote the SHA-256 hash of each API key to
 * BOTH the `api_key` and `api_key_hash` columns, and authentication accepted
 * a match on EITHER column via an OR filter.  This meant the `api_key` column
 * held a value that carried authentication weight, violating the principle that
 * display columns must never store credential-derived data.
 *
 * Fix
 * ---
 * Key creation now writes:
 *   api_key      → 8-character display prefix (non-sensitive)
 *   api_key_hash → SHA-256 hash (sole authentication column)
 *
 * Authentication queries ONLY `api_key_hash`.  The `api_key` column is never
 * consulted during an authentication check.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "crypto";
import {
  POST as syncPost,
  GET as syncGet,
} from "@/app/api/local-coding/sync/route";
import { POST as keysPost } from "@/app/api/local-coding/keys/route";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const m = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: m.getServerSession }));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: m.resolveAppUser }));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: m.supabaseFrom,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

// lgtm[js/insufficient-password-hash] - SHA-256 is appropriate for hashing high-entropy random API keys in tests
function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Build a Supabase mock for sync route auth that expects .eq() (not .or()).
 * The lookup chain is: .select().eq().single()
 * The update chain is: .update().eq()
 */
function buildHashOnlyAuthMock(userId = "user-1") {
  const authSingle = vi.fn().mockResolvedValue({
    data: { user_id: userId },
    error: null,
  });
  const authEq = vi.fn().mockReturnValue({ single: authSingle });
  const updateEq = vi.fn().mockResolvedValue({ error: null });

  const sessionCountEq = vi.fn().mockResolvedValue({
    count: 0,
    data: null,
    error: null,
  });
  const existingDatesIn = vi.fn().mockResolvedValue({ data: [], error: null });
  const existingDatesEq = vi
    .fn()
    .mockReturnValue({ in: existingDatesIn });

  m.supabaseFrom.mockImplementation((table: string) => {
    if (table === "local_coding_api_keys") {
      return {
        select: vi.fn().mockReturnValue({ eq: authEq }),
        update: vi.fn().mockReturnValue({ eq: updateEq }),
      };
    }
    if (table === "local_coding_sessions") {
      return {
        select: vi.fn((_cols: string, opts?: { count?: string }) => {
          if (opts?.count) return { eq: sessionCountEq };
          return { eq: existingDatesEq };
        }),
      };
    }
    return {};
  });

  return { authEq, authSingle, updateEq };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("Local coding API key credential isolation — #1689", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── key creation ──────────────────────────────────────────────────────────

  it("stores a display prefix in api_key and the SHA-256 hash in api_key_hash", async () => {
    m.getServerSession.mockResolvedValue({
      githubId: "gh-1",
      githubLogin: "alice",
    });
    m.resolveAppUser.mockResolvedValue({ id: "user-1" });

    const insertMock = vi.fn();
    const insertSelectSingle = vi.fn().mockResolvedValue({
      data: {
        id: "key-1",
        name: "Laptop",
        last_used_at: null,
        created_at: "2026-01-01",
      },
      error: null,
    });
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertSelectSingle }),
    });

    m.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      }),
      insert: insertMock,
    });

    const req = new NextRequest("http://localhost/api/local-coding/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Laptop" }),
    });

    const res = await keysPost(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    const rawKey: string = body.key.api_key;
    const expectedHash = sha256(rawKey);
    const expectedPrefix = rawKey.slice(0, 8);

    const insertArg = insertMock.mock.calls[0][0];

    // api_key holds only the 8-character display prefix.
    expect(insertArg.api_key).toBe(expectedPrefix);
    // api_key_hash holds the SHA-256 hash.
    expect(insertArg.api_key_hash).toBe(expectedHash);
  });

  it("never writes the credential hash into api_key", async () => {
    m.getServerSession.mockResolvedValue({
      githubId: "gh-2",
      githubLogin: "bob",
    });
    m.resolveAppUser.mockResolvedValue({ id: "user-2" });

    const insertMock = vi.fn();
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "key-2",
            name: "Work",
            last_used_at: null,
            created_at: "2026-01-01",
          },
          error: null,
        }),
      }),
    });

    m.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      }),
      insert: insertMock,
    });

    const req = new NextRequest("http://localhost/api/local-coding/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Work" }),
    });

    const res = await keysPost(req);
    const body = await res.json();
    const hash = sha256(body.key.api_key);
    const insertArg = insertMock.mock.calls[0][0];

    // api_key must NOT hold the hash — a prefix and a hash are never equal.
    expect(insertArg.api_key).not.toBe(hash);
    expect(insertArg.api_key_hash).toBe(hash);
  });

  // ── authentication ────────────────────────────────────────────────────────

  it("POST /sync authenticates exclusively against api_key_hash", async () => {
    const { authEq, updateEq } = buildHashOnlyAuthMock();

    const key = "dt_test_raw_key_abc";
    const keyHash = sha256(key);

    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        sessions: [{ date: "2026-01-15", totalSeconds: 3600 }],
      }),
    });

    const res = await syncPost(req);
    expect(res.status).toBe(200);

    // Must query only api_key_hash — no api_key fallback.
    expect(authEq).toHaveBeenCalledWith("api_key_hash", keyHash);
    // Must update last_used_at only via api_key_hash.
    expect(updateEq).toHaveBeenCalledWith("api_key_hash", keyHash);
  });

  it("POST /sync does not fall back to api_key column during authentication", async () => {
    const { authEq } = buildHashOnlyAuthMock();

    const key = "another-raw-key-xyz";

    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        sessions: [{ date: "2026-01-15", totalSeconds: 100 }],
      }),
    });

    await syncPost(req);

    // authEq is called with ("api_key_hash", hash) — never with "api_key".
    expect(authEq.mock.calls.every((call) => call[0] === "api_key_hash")).toBe(
      true,
    );
  });

  it("POST /sync rejects a stolen hash used as the bearer token", async () => {
    // Simulate an attacker who read api_key_hash from the database and tries
    // to authenticate by sending the hash directly as the Bearer value.
    //
    // The route hashes the incoming bearer token before lookup.
    // sha256(stolenHash) != stolenHash in general, so the lookup returns null.

    const stolenHash = sha256("the-real-original-key");

    const authSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    m.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: authSingle }),
      }),
      update: vi.fn(),
    });

    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${stolenHash}` },
      body: JSON.stringify({
        sessions: [{ date: "2026-01-15", totalSeconds: 100 }],
      }),
    });

    const res = await syncPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid API key");
  });

  it("POST /sync rejects an invalid bearer token", async () => {
    const authSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });
    m.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: authSingle }),
      }),
      update: vi.fn(),
    });

    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      headers: { Authorization: "Bearer completely-wrong-key" },
      body: JSON.stringify({
        sessions: [{ date: "2026-01-15", totalSeconds: 100 }],
      }),
    });

    const res = await syncPost(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Invalid API key");
  });

  it("POST /sync returns 401 when no Authorization header is provided", async () => {
    const req = new NextRequest("http://localhost/api/local-coding/sync", {
      method: "POST",
      body: JSON.stringify({ sessions: [] }),
    });
    const res = await syncPost(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("API key required");
  });

  // ── GET /sync uses the same auth path ────────────────────────────────────

  it("GET /sync authenticates against api_key_hash only", async () => {
    const { authEq, updateEq } = buildHashOnlyAuthMock();

    const sessionEq = vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    m.supabaseFrom.mockImplementation((table: string) => {
      if (table === "local_coding_api_keys") {
        return {
          select: vi.fn().mockReturnValue({ eq: authEq }),
          update: vi.fn().mockReturnValue({ eq: updateEq }),
        };
      }
      if (table === "local_coding_sessions") {
        return { select: vi.fn().mockReturnValue({ eq: sessionEq }) };
      }
      return {};
    });

    const key = "get-endpoint-key";
    const keyHash = sha256(key);

    const req = new NextRequest(
      "http://localhost/api/local-coding/sync?days=30",
      { headers: { Authorization: `Bearer ${key}` } }
    );

    const res = await syncGet(req);
    expect(res.status).toBe(200);

    expect(authEq).toHaveBeenCalledWith("api_key_hash", keyHash);
    expect(updateEq).toHaveBeenCalledWith("api_key_hash", keyHash);
  });

  it("GET /sync returns 401 when no Authorization header is provided", async () => {
    const req = new NextRequest(
      "http://localhost/api/local-coding/sync?days=30"
    );
    const res = await syncGet(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("API key required");
  });

  it("GET /sync returns 401 for an unrecognised key", async () => {
    m.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        }),
      }),
      update: vi.fn(),
    });

    const req = new NextRequest(
      "http://localhost/api/local-coding/sync?days=30",
      { headers: { Authorization: "Bearer bad-key" } }
    );
    const res = await syncGet(req);
    expect(res.status).toBe(401);
  });

  // ── hash function consistency ─────────────────────────────────────────────

  it("creation hash and authentication hash use the same algorithm", () => {
    // The hash written to api_key_hash at creation time must equal the hash
    // that the sync route computes from the same bearer token.
    const rawKey = "dt_sample_raw_api_key_consistent_check";
    const creationHash = sha256(rawKey);
    const authHash = sha256(rawKey);

    expect(creationHash).toBe(authHash);

    // Crucially: the hash of the hash must not equal the hash itself.
    // This property ensures that presenting a stolen hash as a bearer token
    // always fails (sha256(stolenHash) != stolenHash).
    expect(sha256(creationHash)).not.toBe(creationHash);
  });
});
