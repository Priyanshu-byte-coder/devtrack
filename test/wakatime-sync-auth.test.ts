import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/wakatime/sync/route";

// --- hoisted mocks ---

const mocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  decryptToken: vi.fn(),
  wakatimeFetch: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

vi.mock("@/lib/crypto", () => ({
  decryptToken: mocks.decryptToken,
}));

vi.stubGlobal("fetch", mocks.wakatimeFetch);

// --- helpers ---

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/wakatime/sync", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

/** Sets up Supabase to return zero users (no-op sync). */
function stubEmptySync() {
  mocks.supabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      not: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  });
}

// --- tests ---

describe("GET /api/wakatime/sync - authentication hardening (#1746 #1657)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // -- missing CRON_SECRET - fail closed --

  it("returns 500 when CRON_SECRET is not set - regression for #1746", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await GET(makeRequest("Bearer anything"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET.*not configured/i);
    // Sync must never run when the secret is absent
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("rejects Authorization: Bearer undefined when CRON_SECRET is absent - regression for #1746", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await GET(makeRequest("Bearer undefined"));
    // Must NOT return 200; must not execute the sync.
    expect(res.status).not.toBe(200);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // -- wrong secret - reject --

  it("returns 401 when the secret is present but the header is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 when no authorization header is provided", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 for a plaintext secret without the Bearer prefix", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const res = await GET(makeRequest("correct-secret"));
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // -- correct secret - allow --

  it("proceeds with the sync when the correct Bearer token is supplied", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    stubEmptySync();

    const res = await GET(makeRequest("Bearer s3cr3t"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("failure");
  });

  // -- development environment - no bypass (#1657) --
  // Authentication must be enforced in every environment. NODE_ENV must not
  // be used as a gate - any process running locally, or an attacker who can
  // control that variable, could otherwise trigger a bulk sync freely.

  it("rejects a wrong secret in development - no NODE_ENV bypass (#1657)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");

    const res = await GET(makeRequest("Bearer totally-wrong"));
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("rejects a missing header in development - no NODE_ENV bypass (#1657)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 500 in development when CRON_SECRET is missing (#1657)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");

    const res = await GET(makeRequest("Bearer s3cr3t"));
    expect(res.status).toBe(500);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("allows a correct secret in development (#1657)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");
    stubEmptySync();

    const res = await GET(makeRequest("Bearer s3cr3t"));
    expect(res.status).toBe(200);
  });

  // -- sync execution path --

  it("decrypts WakaTime keys and calls the WakaTime API for each user", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");

    mocks.decryptToken.mockReturnValue("waka-api-key");
    mocks.wakatimeFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            range: { date: "2026-05-01" },
            grand_total: { total_seconds: 3600 },
            languages: [{ name: "TypeScript", total_seconds: 1800, percent: 50 }],
            projects: [{ name: "devtrack", total_seconds: 3600, percent: 100 }],
          },
        ],
      }),
    });

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: [
                  { id: "user-1", wakatime_api_key_encrypted: "enc", wakatime_api_key_iv: "iv" },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "wakatime_stats") {
        return { upsert: upsertMock };
      }
      return {};
    });

    const res = await GET(makeRequest("Bearer s3cr3t"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(1);
    expect(body.failure).toBe(0);
    expect(mocks.decryptToken).toHaveBeenCalledWith("enc", "iv");
    expect(mocks.wakatimeFetch).toHaveBeenCalledWith(
      expect.stringContaining("wakatime.com"),
      expect.any(Object)
    );
    expect(upsertMock).toHaveBeenCalledOnce();
  });

  it("counts a failure when WakaTime API key decryption fails", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");

    mocks.decryptToken.mockReturnValue(null); // decryption failed

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: [{ id: "user-1", wakatime_api_key_encrypted: "enc", wakatime_api_key_iv: "iv" }],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await GET(makeRequest("Bearer s3cr3t"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.failure).toBe(1);
    expect(body.success).toBe(0);
    expect(mocks.wakatimeFetch).not.toHaveBeenCalled();
  });
});