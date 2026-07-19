import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("supabase-admin env validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("getValidatedAdminEnv", () => {
    it("returns url and serviceRoleKey when both env vars are valid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-service-role-key-123");

      // Re-evaluate the module to pick up stubbed env vars
      await import("@/lib/supabase-admin");

      // Access getValidatedAdminEnv by re-importing after env is set
      // We verify indirectly: isSupabaseAdminAvailable should be true
      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(true);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_URL contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-key");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });

    it("returns null when SUPABASE_SERVICE_ROLE_KEY contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "placeholder-key");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-key");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });

    it("returns null when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });

    it("returns null when both env vars are empty strings", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_URL is undefined", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined as any);
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-key");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });

    it("treats placeholder anywhere in URL as invalid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-placeholder-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-key");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });

    it("treats placeholder anywhere in service role key as invalid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9");

      const { isSupabaseAdminAvailable } = await import("@/lib/supabase-admin");
      expect(isSupabaseAdminAvailable).toBe(false);
    });
  });

  describe("isSupabaseAdminAvailable", () => {
    it("is true when both env vars are valid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-key");

      const mod = await import("@/lib/supabase-admin");
      expect(mod.isSupabaseAdminAvailable).toBe(true);
    });

    it("is false when url contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-key");

      const mod = await import("@/lib/supabase-admin");
      expect(mod.isSupabaseAdminAvailable).toBe(false);
    });

    it("is false when service role key contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "placeholder_service_role_key");

      const mod = await import("@/lib/supabase-admin");
      expect(mod.isSupabaseAdminAvailable).toBe(false);
    });

    it("is false when url is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "valid-key");

      const mod = await import("@/lib/supabase-admin");
      expect(mod.isSupabaseAdminAvailable).toBe(false);
    });

    it("is false when service role key is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

      const mod = await import("@/lib/supabase-admin");
      expect(mod.isSupabaseAdminAvailable).toBe(false);
    });
  });
});
