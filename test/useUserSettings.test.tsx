import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderHook, act } from "@testing-library/react";

import { useUserSettings } from "../src/hooks/useUserSettings";

describe("useUserSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sets data on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "u1",
        github_login: "gh",
        bio: "bio",
        is_public: true,
        leaderboard_opt_in: true,
        weekly_digest_opt_in: false,
        pinned_repos: [],
        has_wakatime_key: false,
        discord_webhook_url: null,
        timezone: "UTC",
        webhook_url: null,
        discord_muted_until: null,
        preferred_locale: "en",
      }),
    } as any));

    const { result } = renderHook(() => useUserSettings());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.data?.id).toBe("u1");
  });

  it("sets error on failed fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 } as any));

    const { result } = renderHook(() => useUserSettings());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("refetch updates data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "initial", github_login: "gh0", bio: "", is_public: false, leaderboard_opt_in: false, weekly_digest_opt_in: false, pinned_repos: [], has_wakatime_key: false, discord_webhook_url: null, timezone: "UTC", webhook_url: null, discord_muted_until: null, preferred_locale: "en" }) } as any)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "u1", github_login: "gh1", bio: "", is_public: false, leaderboard_opt_in: false, weekly_digest_opt_in: false, pinned_repos: [], has_wakatime_key: false, discord_webhook_url: null, timezone: "UTC", webhook_url: null, discord_muted_until: null, preferred_locale: "en" }) } as any);

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useUserSettings());

    // Wait for initial mount fetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.data?.id).toBe("initial");

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data?.id).toBe("u1");
  });
});
