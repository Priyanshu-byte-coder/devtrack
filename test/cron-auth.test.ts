/**
 * Tests for the shared cron authentication guard (src/lib/cron-auth.ts) and
 * regression coverage for the development-environment bypass removed in #1657.
 *
 * Background
 * ----------
 * Three cron/sync routes previously contained:
 *
 *   if (authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
 *     return 401
 *   }
 *
 * This made the entire authorization check a no-op whenever NODE_ENV was set
 * to "development".  Any local process — or an attacker who controls that
 * variable — could invoke bulk operations (sponsor sync, wakatime sync,
 * discord notifications) without presenting any credential.
 *
 * The fix centralises validation in validateCronRequest() and removes the
 * NODE_ENV condition.  These tests verify the new behaviour.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { validateCronRequest } from "@/lib/cron-auth";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/test", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

// ─── validateCronRequest unit tests ─────────────────────────────────────────

describe("validateCronRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── missing CRON_SECRET — fail closed ─────────────────────────────────────

  it("returns a 500 response when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const result = validateCronRequest(makeRequest("Bearer anything"));

    expect(result).not.toBeNull();
    expect(result!.status).toBe(500);
    const body = await result!.json();
    expect(body.error).toMatch(/CRON_SECRET.*not configured/i);
  });

  it("returns 500 even when called without any header if CRON_SECRET is absent", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const result = validateCronRequest(makeRequest());

    expect(result).not.toBeNull();
    expect(result!.status).toBe(500);
  });

  // ── wrong or missing Authorization header — reject ────────────────────────

  it("returns 401 when the Authorization header is absent", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const result = validateCronRequest(makeRequest());

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when the Authorization header contains a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const result = validateCronRequest(makeRequest("Bearer wrong-secret"));

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 for a plaintext secret without the Bearer prefix", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");

    const result = validateCronRequest(makeRequest("correct-secret"));

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when the header is 'Bearer undefined' (classic misconfiguration attack)", async () => {
    vi.stubEnv("CRON_SECRET", "real-secret");

    const result = validateCronRequest(makeRequest("Bearer undefined"));

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  // ── correct secret — allow ────────────────────────────────────────────────

  it("returns null (proceed) when the correct Bearer token is supplied", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");

    const result = validateCronRequest(makeRequest("Bearer s3cr3t"));

    expect(result).toBeNull();
  });

  // ── development environment — same rules (#1657) ──────────────────────────
  // NODE_ENV must not be used as a bypass.  The same credential rules apply
  // in all environments.

  it("returns 401 in development for a wrong secret — no NODE_ENV bypass (#1657)", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");

    const result = validateCronRequest(makeRequest("Bearer wrong-secret"));

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 in development for a missing header — no NODE_ENV bypass (#1657)", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");

    const result = validateCronRequest(makeRequest());

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 500 in development when CRON_SECRET is absent — no NODE_ENV bypass (#1657)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");

    const result = validateCronRequest(makeRequest("Bearer s3cr3t"));

    expect(result).not.toBeNull();
    expect(result!.status).toBe(500);
  });

  it("returns null in development when the correct secret is supplied (#1657)", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");

    const result = validateCronRequest(makeRequest("Bearer s3cr3t"));

    expect(result).toBeNull();
  });
});

// ─── discord-sync route — auth regression tests (#1657) ──────────────────────

const discordMocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  fetchPublicStreak: vi.fn(),
  fetchPublicContributions: vi.fn(),
  sendStreakAtRisk: vi.fn(),
  sendMilestoneReached: vi.fn(),
  sendWeeklySummary: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: discordMocks.supabaseFrom },
}));

vi.mock("@/lib/public-profile-data", () => ({
  fetchPublicStreak: discordMocks.fetchPublicStreak,
  fetchPublicContributions: discordMocks.fetchPublicContributions,
}));

vi.mock("@/lib/discord", () => ({
  sendStreakAtRisk: discordMocks.sendStreakAtRisk,
  sendMilestoneReached: discordMocks.sendMilestoneReached,
  sendWeeklySummary: discordMocks.sendWeeklySummary,
}));

describe("GET /api/notifications/discord-sync — authentication (#1657)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  function makeDiscordRequest(authHeader?: string): Request {
    return new Request("http://localhost/api/notifications/discord-sync", {
      headers: authHeader ? { authorization: authHeader } : {},
    });
  }

  // ── missing CRON_SECRET — fail closed ─────────────────────────────────────

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const { GET } = await import("@/app/api/notifications/discord-sync/route");
    const res = await GET(makeDiscordRequest("Bearer anything"));

    expect(res.status).toBe(500);
    expect(discordMocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // ── invalid header — reject ───────────────────────────────────────────────

  it("returns 401 when the Authorization header is missing", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");

    const { GET } = await import("@/app/api/notifications/discord-sync/route");
    const res = await GET(makeDiscordRequest());

    expect(res.status).toBe(401);
    expect(discordMocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is wrong", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");

    const { GET } = await import("@/app/api/notifications/discord-sync/route");
    const res = await GET(makeDiscordRequest("Bearer wrong"));

    expect(res.status).toBe(401);
    expect(discordMocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // ── development — no bypass (#1657) ──────────────────────────────────────

  it("returns 401 in development for a wrong secret — no NODE_ENV bypass (#1657)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");

    const { GET } = await import("@/app/api/notifications/discord-sync/route");
    const res = await GET(makeDiscordRequest("Bearer wrong"));

    expect(res.status).toBe(401);
    expect(discordMocks.supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns 401 in development for a missing header — no NODE_ENV bypass (#1657)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.stubEnv("NODE_ENV", "development");

    const { GET } = await import("@/app/api/notifications/discord-sync/route");
    const res = await GET(makeDiscordRequest());

    expect(res.status).toBe(401);
    expect(discordMocks.supabaseFrom).not.toHaveBeenCalled();
  });

  // ── valid secret — allow ──────────────────────────────────────────────────

  it("proceeds past auth when the correct Bearer token is supplied", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");

    // Supabase returns no users — the job completes immediately
    discordMocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const { GET } = await import("@/app/api/notifications/discord-sync/route");
    const res = await GET(makeDiscordRequest("Bearer s3cr3t"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(0);
  });
});
