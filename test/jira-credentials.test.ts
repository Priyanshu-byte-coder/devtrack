/**
 * Regression tests for Jira credential encryption at rest (#1797).
 *
 * Background
 * ----------
 * Jira API tokens are sensitive credentials. If stored in plaintext, a
 * database breach or misconfigured backup would expose every connected user's
 * Jira token directly.
 *
 * The fix applies AES-256-GCM authenticated encryption (via the project's
 * existing encryptToken/decryptToken helpers in src/lib/crypto.ts) before
 * persisting a credential and decrypts only when the token is needed for an
 * outbound Jira API call. The plaintext token is never written to the database
 * and never returned in any API response.
 *
 * These tests verify the complete credential lifecycle:
 *   - POST stores encrypted values, not plaintext
 *   - GET (credentials list) never exposes the token
 *   - DELETE removes the credential
 *   - GET (Jira data) decrypts and uses the token for Jira API calls
 *   - Decryption failures are handled gracefully
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  encryptToken: vi.fn(),
  decryptToken: vi.fn(),
  externalFetch: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));
vi.mock("@/lib/crypto", () => ({
  encryptToken: mocks.encryptToken,
  decryptToken: mocks.decryptToken,
}));

// Stub global fetch for Jira connection test and Jira API calls
vi.stubGlobal("fetch", mocks.externalFetch);

// ─── helpers ────────────────────────────────────────────────────────────────

const PLAINTEXT_TOKEN = "my-jira-api-token-abc123";
const ENCRYPTED_TOKEN = "aabbccdd11223344aabbccdd1122334400112233";
const ENCRYPTED_IV    = "001122334455667788990011";

function authedSession() {
  mocks.getServerSession.mockResolvedValue({
    githubId: "gh-1",
    githubLogin: "alice",
  });
  mocks.resolveAppUser.mockResolvedValue({ id: "user-uuid" });
}

function credentialsPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/integrations/jira/credentials", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function credentialsGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/integrations/jira/credentials");
}

function credentialsDeleteRequest(id?: string): NextRequest {
  const url = id
    ? `http://localhost/api/integrations/jira/credentials?id=${id}`
    : "http://localhost/api/integrations/jira/credentials";
  return new NextRequest(url, { method: "DELETE" });
}

function jiraDataGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/integrations/jira");
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("POST /api/integrations/jira/credentials — encryption at rest (#1797)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedSession();
    mocks.encryptToken.mockReturnValue({
      encrypted: ENCRYPTED_TOKEN,
      iv: ENCRYPTED_IV,
    });
    // Jira connection test passes
    mocks.externalFetch.mockResolvedValue({ ok: true });
  });

  it("stores the encrypted token, never the plaintext — regression for #1797", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mocks.supabaseFrom.mockReturnValue({ upsert: upsertMock });

    const { POST } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await POST(
      credentialsPostRequest({
        jiraDomain: "mycompany.atlassian.net",
        email: "alice@example.com",
        apiToken: PLAINTEXT_TOKEN,
      })
    );

    expect(res.status).toBe(200);

    // encryptToken must have been called with the plaintext token
    expect(mocks.encryptToken).toHaveBeenCalledWith(PLAINTEXT_TOKEN);

    // The upsert payload must contain the ENCRYPTED value, not the plaintext
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        api_token: ENCRYPTED_TOKEN,
        token_iv: ENCRYPTED_IV,
      }),
      expect.any(Object)
    );
    expect(upsertMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ api_token: PLAINTEXT_TOKEN }),
      expect.any(Object)
    );
  });

  it("never returns the API token in the response body", async () => {
    mocks.supabaseFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const { POST } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await POST(
      credentialsPostRequest({
        jiraDomain: "mycompany.atlassian.net",
        email: "alice@example.com",
        apiToken: PLAINTEXT_TOKEN,
      })
    );

    const body = await res.json();

    // The response must not contain the token in any form
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(PLAINTEXT_TOKEN);
    expect(serialised).not.toContain(ENCRYPTED_TOKEN);
    expect(serialised).not.toContain("api_token");
    expect(serialised).not.toContain("token_iv");
  });

  it("validates the Jira connection before storing credentials", async () => {
    // Jira connectivity check fails
    mocks.externalFetch.mockResolvedValue({ ok: false });
    mocks.supabaseFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    const { POST } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await POST(
      credentialsPostRequest({
        jiraDomain: "mycompany.atlassian.net",
        email: "alice@example.com",
        apiToken: PLAINTEXT_TOKEN,
      })
    );

    expect(res.status).toBe(400);
    // Token must never be encrypted or stored when validation fails
    expect(mocks.encryptToken).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await POST(
      credentialsPostRequest({
        jiraDomain: "mycompany.atlassian.net",
        email: "alice@example.com",
        apiToken: PLAINTEXT_TOKEN,
      })
    );
    expect(res.status).toBe(401);
    expect(mocks.encryptToken).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid Jira domain format", async () => {
    const { POST } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await POST(
      credentialsPostRequest({
        jiraDomain: "not-a-valid-domain.example.com",
        email: "alice@example.com",
        apiToken: PLAINTEXT_TOKEN,
      })
    );
    expect(res.status).toBe(400);
    expect(mocks.encryptToken).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await POST(
      credentialsPostRequest({ jiraDomain: "mycompany.atlassian.net" })
    );
    expect(res.status).toBe(400);
    expect(mocks.encryptToken).not.toHaveBeenCalled();
  });
});

describe("GET /api/integrations/jira/credentials — token never exposed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedSession();
  });

  it("lists credentials without including any token fields", async () => {
    // The route uses a column-restricted SELECT: "id, jira_domain, email,
    // project_key, is_active, created_at". The real Supabase client only
    // returns columns that are explicitly requested, so the mock should
    // reflect the same constraint — no api_token or token_iv in the response.
    const selectEq = vi.fn().mockResolvedValue({
      data: [
        {
          id: "cred-1",
          jira_domain: "mycompany.atlassian.net",
          email: "alice@example.com",
          project_key: "PROJ",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          // api_token and token_iv are intentionally absent — matching what
          // Supabase returns for a column-restricted SELECT.
        },
      ],
      error: null,
    });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: selectEq }),
    });

    const { GET } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await GET(credentialsGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    const serialised = JSON.stringify(body);

    // The response must not leak any token data
    expect(serialised).not.toContain(ENCRYPTED_TOKEN);
    expect(serialised).not.toContain(ENCRYPTED_IV);
    expect(serialised).not.toContain("api_token");
    expect(serialised).not.toContain("token_iv");

    // Public-safe fields must be present
    const cred = body.credentials[0];
    expect(cred.jira_domain).toBe("mycompany.atlassian.net");
    expect(cred.email).toBe("alice@example.com");
  });

  it("uses a column-restricted SELECT that excludes token columns", async () => {
    // This test verifies the route explicitly names the columns it fetches
    // rather than using select("*"), ensuring token fields can never leak.
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mocks.supabaseFrom.mockReturnValue({ select: selectMock });

    const { GET } = await import("@/app/api/integrations/jira/credentials/route");
    await GET(credentialsGetRequest());

    // The SELECT clause must name safe columns — it must NOT use "*"
    const selectArg: string = selectMock.mock.calls[0][0];
    expect(selectArg).not.toContain("*");
    expect(selectArg).toContain("id");
    expect(selectArg).toContain("jira_domain");
    expect(selectArg).toContain("email");
    expect(selectArg).not.toContain("api_token");
    expect(selectArg).not.toContain("token_iv");
  });

  it("returns an empty array when no credentials exist", async () => {
    const selectEq = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: selectEq }),
    });

    const { GET } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await GET(credentialsGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.credentials).toEqual([]);
  });
});

describe("DELETE /api/integrations/jira/credentials — credential removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedSession();
  });

  it("deletes a specific credential by ID", async () => {
    const deleteMock = vi.fn().mockResolvedValue({ error: null });
    const eqUserMock = vi.fn().mockReturnValue(deleteMock);
    const eqIdMock   = vi.fn().mockReturnValue({ eq: eqUserMock });
    mocks.supabaseFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: eqIdMock }),
    });

    const { DELETE } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await DELETE(credentialsDeleteRequest("cred-1"));

    expect(res.status).toBe(200);
  });

  it("deletes all credentials for the user when no ID is provided", async () => {
    const deleteMock = vi.fn().mockResolvedValue({ error: null });
    const eqMock     = vi.fn().mockReturnValue(deleteMock);
    mocks.supabaseFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: eqMock }),
    });

    const { DELETE } = await import("@/app/api/integrations/jira/credentials/route");
    const res = await DELETE(credentialsDeleteRequest());

    expect(res.status).toBe(200);
  });
});

describe("GET /api/integrations/jira — decryption and Jira API usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedSession();
  });

  function stubStoredCredential() {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "cred-1",
        jira_domain: "mycompany.atlassian.net",
        email: "alice@example.com",
        api_token: ENCRYPTED_TOKEN,
        token_iv: ENCRYPTED_IV,
        project_key: null,
      },
      error: null,
    });
    const limitMock  = vi.fn().mockReturnValue({ single: singleMock });
    const eqActiveMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqUserMock   = vi.fn().mockReturnValue({ eq: eqActiveMock });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqUserMock }),
    });
  }

  it("decrypts the stored token before calling the Jira API", async () => {
    stubStoredCredential();
    mocks.decryptToken.mockReturnValue(PLAINTEXT_TOKEN);
    mocks.externalFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ issues: [] }),
    });

    const { GET } = await import("@/app/api/integrations/jira/route");
    await GET(jiraDataGetRequest());

    // decryptToken must be called with the encrypted values from the DB
    expect(mocks.decryptToken).toHaveBeenCalledWith(ENCRYPTED_TOKEN, ENCRYPTED_IV);

    // The Jira API call must use the decrypted token, not the encrypted blob
    const fetchCall = mocks.externalFetch.mock.calls[0];
    const [, callOptions] = fetchCall;
    const authHeader: string = callOptions.headers.Authorization;
    const expectedBasic = `Basic ${Buffer.from(`alice@example.com:${PLAINTEXT_TOKEN}`).toString("base64")}`;
    expect(authHeader).toBe(expectedBasic);
    expect(authHeader).not.toContain(ENCRYPTED_TOKEN);
  });

  it("returns 500 when decryption fails", async () => {
    stubStoredCredential();
    mocks.decryptToken.mockReturnValue(null); // decryption failed

    const { GET } = await import("@/app/api/integrations/jira/route");
    const res = await GET(jiraDataGetRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/decrypt/i);
    // The Jira API must NOT be called when decryption fails
    expect(mocks.externalFetch).not.toHaveBeenCalled();
  });

  it("returns 404 when no active Jira credentials exist", async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const limitMock  = vi.fn().mockReturnValue({ single: singleMock });
    const eqActiveMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqUserMock   = vi.fn().mockReturnValue({ eq: eqActiveMock });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqUserMock }),
    });

    const { GET } = await import("@/app/api/integrations/jira/route");
    const res = await GET(jiraDataGetRequest());

    expect(res.status).toBe(404);
  });

  it("never returns credential data in the Jira metrics response", async () => {
    stubStoredCredential();
    mocks.decryptToken.mockReturnValue(PLAINTEXT_TOKEN);
    mocks.externalFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ issues: [] }),
    });

    const { GET } = await import("@/app/api/integrations/jira/route");
    const res = await GET(jiraDataGetRequest());

    const body = await res.json();
    const serialised = JSON.stringify(body);

    expect(serialised).not.toContain(PLAINTEXT_TOKEN);
    expect(serialised).not.toContain(ENCRYPTED_TOKEN);
    expect(serialised).not.toContain(ENCRYPTED_IV);
  });
});
