import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSupabaseAdminAvailable: true,
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<string[]>) => fn,
}));

vi.mock("@/lib/supabase-admin", () => ({
  get isSupabaseAdminAvailable() {
    return mocks.isSupabaseAdminAvailable;
  },
  supabaseAdmin: {
    from: mocks.from,
  },
}));

import { getPublicSupporters } from "@/lib/supporters";

describe("getPublicSupporters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLAYWRIGHT_TEST = "false";

    mocks.isSupabaseAdminAvailable = true;
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ eq: mocks.eq, order: mocks.order });
    mocks.order.mockReturnValue({ limit: mocks.limit });
  });

  afterEach(() => {
    delete process.env.PLAYWRIGHT_TEST;
  });

  it("returns the Playwright test supporter without querying Supabase", async () => {
    process.env.PLAYWRIGHT_TEST = "true";

    await expect(getPublicSupporters()).resolves.toEqual(["playwright-user"]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns an empty list when Supabase admin is unavailable", async () => {
    mocks.isSupabaseAdminAvailable = false;

    await expect(getPublicSupporters()).resolves.toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns public sponsor logins from the database", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { github_login: "alice" },
        { github_login: "bob" },
      ],
      error: null,
    });

    await expect(getPublicSupporters()).resolves.toEqual(["alice", "bob"]);

    expect(mocks.from).toHaveBeenCalledWith("users");
    expect(mocks.select).toHaveBeenCalledWith("github_login");
    expect(mocks.limit).toHaveBeenCalledWith(200);
  });

  it("filters out empty and non-string GitHub logins", async () => {
    mocks.limit.mockResolvedValue({
      data: [
        { github_login: "alice" },
        { github_login: "" },
        { github_login: null },
        { github_login: 42 },
        { github_login: "bob" },
      ],
      error: null,
    });

    await expect(getPublicSupporters()).resolves.toEqual(["alice", "bob"]);
  });

  it("returns an empty list when the database query fails", async () => {
    mocks.limit.mockResolvedValue({
      data: null,
      error: new Error("Database unavailable"),
    });

    await expect(getPublicSupporters()).resolves.toEqual([]);
  });

  it("returns an empty list when the query has no data", async () => {
    mocks.limit.mockResolvedValue({ data: null, error: null });

    await expect(getPublicSupporters()).resolves.toEqual([]);
  });
});
