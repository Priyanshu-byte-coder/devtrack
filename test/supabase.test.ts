import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

describe("supabase module exports", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("isSupabaseAdminAvailable is false when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { isSupabaseAdminAvailable } = await import("@/lib/supabase");
    expect(isSupabaseAdminAvailable).toBe(false);
  });

  it("isSupabaseAdminAvailable is false when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { isSupabaseAdminAvailable } = await import("@/lib/supabase");
    expect(isSupabaseAdminAvailable).toBe(false);
  });

  it("isSupabaseAdminAvailable is false when URL contains placeholder", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://<project-ref>.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJ...";
    const { isSupabaseAdminAvailable } = await import("@/lib/supabase");
    expect(isSupabaseAdminAvailable).toBe(false);
  });

  it("isSupabaseAdminAvailable is true when both env vars are set with real values", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiYyIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NjY2NjY2NjYsImV4cCI6MTk4MjI0MjY2Nn0.fake_sig";
    const { isSupabaseAdminAvailable } = await import("@/lib/supabase");
    expect(isSupabaseAdminAvailable).toBe(true);
  });

  it("SUPABASE_ADMIN_UNAVAILABLE_MESSAGE is non-empty", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { SUPABASE_ADMIN_UNAVAILABLE_MESSAGE } = await import("@/lib/supabase");
    expect(typeof SUPABASE_ADMIN_UNAVAILABLE_MESSAGE).toBe("string");
    expect(SUPABASE_ADMIN_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0);
  });

  it("supabaseAdmin.from() throws when admin is unavailable", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { supabaseAdmin } = await import("@/lib/supabase");
    expect(() => (supabaseAdmin as unknown as { from: (t: string) => { then: (fn: () => void) => void } }).from("users")).toThrow("Supabase admin client is unavailable");
  });
});
