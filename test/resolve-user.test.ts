import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixedDate = new Date("2026-05-31T10:15:30.000Z");

type SupabaseResult = {
  data: unknown;
  error: null | { code?: string; message?: string };
};

function createSupabaseMock({
  lookupResult,
  upsertResult,
  lookupThrows,
  upsertThrows,
}: {
  lookupResult?: SupabaseResult;
  upsertResult?: SupabaseResult;
  lookupThrows?: unknown;
  upsertThrows?: unknown;
} = {}) {
  const lookupSingle = vi.fn();
  if (lookupThrows) {
    lookupSingle.mockRejectedValue(lookupThrows);
  } else {
    lookupSingle.mockResolvedValue(
      lookupResult ?? { data: null, error: { code: "PGRST116" } }
    );
  }

  const upsertSingle = vi.fn();
  if (upsertThrows) {
    upsertSingle.mockRejectedValue(upsertThrows);
  } else {
    upsertSingle.mockResolvedValue(
      upsertResult ?? { data: { id: "created-user" }, error: null }
    );
  }

  const upsertSelect = vi.fn().mockReturnValue({ single: upsertSingle });
  const upsert = vi.fn().mockReturnValue({ select: upsertSelect });
  const select = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const from = vi.fn().mockReturnValue({
    select,
    eq,
    single: lookupSingle,
    upsert,
  });

  return {
    from,
    select,
    eq,
    lookupSingle,
    upsert,
    upsertSelect,
    upsertSingle,
  };
}

async function loadResolveAppUser(supabaseMock: ReturnType<typeof createSupabaseMock>) {
  vi.doMock("@/lib/supabase", () => ({
    supabaseAdmin: { from: supabaseMock.from },
  }));

  return import("@/lib/resolve-user");
}

describe("resolveAppUser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("@/lib/supabase");
  });

  it("exports resolveAppUser as a function", async () => {
    const supabase = createSupabaseMock();
    const module = await loadResolveAppUser(supabase);

    expect(module.resolveAppUser).toEqual(expect.any(Function));
  });

  it("returns an existing user resolved by GitHub id without upserting", async () => {
    const supabase = createSupabaseMock({
      lookupResult: { data: { id: "user-123" }, error: null },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123", "octocat");

    expect(result).toEqual({ id: "user-123" });
    expect(supabase.from).toHaveBeenCalledWith("users");
    expect(supabase.select).toHaveBeenCalledWith("id");
    expect(supabase.eq).toHaveBeenCalledWith("github_id", "github-123");
    expect(supabase.lookupSingle).toHaveBeenCalledTimes(1);
    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns an existing user even when githubLogin is missing", async () => {
    const supabase = createSupabaseMock({
      lookupResult: { data: { id: "existing-without-login" }, error: null },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123");

    expect(result).toEqual({ id: "existing-without-login" });
    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("upserts and returns a new user when lookup misses and githubLogin is provided", async () => {
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
      upsertResult: { data: { id: "new-user-456" }, error: null },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-new", "newuser");

    expect(result).toEqual({ id: "new-user-456" });
    expect(supabase.upsert).toHaveBeenCalledWith(
      {
        github_id: "github-new",
        github_login: "newuser",
        updated_at: fixedDate.toISOString(),
      },
      { onConflict: "github_id" }
    );
    expect(supabase.upsertSelect).toHaveBeenCalledWith("id");
    expect(supabase.upsertSingle).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("passes empty GitHub ids through to the lookup and upsert calls", async () => {
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
      upsertResult: { data: { id: "empty-id-user" }, error: null },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("", "login-for-empty-id");

    expect(result).toEqual({ id: "empty-id-user" });
    expect(supabase.eq).toHaveBeenCalledWith("github_id", "");
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ github_id: "", github_login: "login-for-empty-id" }),
      { onConflict: "github_id" }
    );
  });

  it("passes null GitHub ids through when called with invalid runtime input", async () => {
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
      upsertResult: { data: { id: "null-id-user" }, error: null },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser(null as unknown as string, "null-login");

    expect(result).toEqual({ id: "null-id-user" });
    expect(supabase.eq).toHaveBeenCalledWith("github_id", null);
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ github_id: null, github_login: "null-login" }),
      { onConflict: "github_id" }
    );
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
  ])("returns null and skips upsert when githubLogin is %s after a missing user", async (_label, githubLogin) => {
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123", githubLogin as string | undefined);

    expect(result).toBeNull();
    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("Missing githubLogin");
  });

  it("treats whitespace githubLogin as provided and upserts it unchanged", async () => {
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
      upsertResult: { data: { id: "whitespace-user" }, error: null },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-space", "   ");

    expect(result).toEqual({ id: "whitespace-user" });
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ github_login: "   " }),
      { onConflict: "github_id" }
    );
  });

  it("returns null and logs when the lookup fails with a non-missing-user error", async () => {
    const existingError = { code: "500", message: "database unavailable" };
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: existingError },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123", "octocat");

    expect(result).toBeNull();
    expect(supabase.upsert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching existing user:",
      existingError
    );
  });

  it("returns null and logs when upsert fails", async () => {
    const upsertError = { code: "23505", message: "conflict" };
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
      upsertResult: { data: null, error: upsertError },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123", "octocat");

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith("Error upserting user:", upsertError);
  });

  it("returns null when upsert succeeds without returning a row", async () => {
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
      upsertResult: { data: null, error: null },
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123", "octocat");

    expect(result).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns null and logs when the lookup query throws", async () => {
    const thrown = new Error("lookup chain failed");
    const supabase = createSupabaseMock({ lookupThrows: thrown });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123", "octocat");

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith("resolveAppUser failed:", thrown);
  });

  it("returns null and logs when the upsert query throws", async () => {
    const thrown = new Error("upsert chain failed");
    const supabase = createSupabaseMock({
      lookupResult: { data: null, error: { code: "PGRST116" } },
      upsertThrows: thrown,
    });
    const { resolveAppUser } = await loadResolveAppUser(supabase);

    const result = await resolveAppUser("github-123", "octocat");

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith("resolveAppUser failed:", thrown);
  });
});
