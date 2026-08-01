import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("supabase-browser env validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("getValidatedBrowserEnv", () => {
    it("returns url and anonKey when both env vars are valid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key-123");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(true);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_URL contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_ANON_KEY contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });

    it("returns null when both env vars are empty strings", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });

    it("returns null when NEXT_PUBLIC_SUPABASE_URL is undefined", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined as any);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });

    it("treats placeholder anywhere in URL as invalid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-placeholder-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });

    it("treats placeholder anywhere in anon key as invalid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.eyJpc3MiOiJzdXBhYmFzZSJ9");

      const { isBrowserClientAvailable } = await import("@/lib/supabase-browser");
      expect(isBrowserClientAvailable).toBe(false);
    });
  });

  describe("isBrowserClientAvailable", () => {
    it("is true when both env vars are valid", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key");

      const mod = await import("@/lib/supabase-browser");
      expect(mod.isBrowserClientAvailable).toBe(true);
    });

    it("is false when URL contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://placeholder.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key");

      const mod = await import("@/lib/supabase-browser");
      expect(mod.isBrowserClientAvailable).toBe(false);
    });

    it("is false when anon key contains placeholder", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder_anon_key");

      const mod = await import("@/lib/supabase-browser");
      expect(mod.isBrowserClientAvailable).toBe(false);
    });

    it("is false when URL is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "valid-anon-key");

      const mod = await import("@/lib/supabase-browser");
      expect(mod.isBrowserClientAvailable).toBe(false);
    });

    it("is false when anon key is missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://my-project.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

      const mod = await import("@/lib/supabase-browser");
      expect(mod.isBrowserClientAvailable).toBe(false);
    });
  });
});
