import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderHook, act } from "@testing-library/react";

import { useStreak } from "../src/hooks/useStreak";

describe("useStreak", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches /api/streak and sets data when no accountId is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ current: 3, longest: 10, lastCommitDate: null, totalActiveDays: 30 }),
    } as any);

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useStreak(null));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/streak");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.data?.current).toBe(3);
  });

  it("fetches /api/streak?accountId=... when accountId is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ current: 1, longest: 2, lastCommitDate: null, totalActiveDays: 3 }),
    } as any);

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useStreak("abc"));

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/streak?accountId=abc");
    expect(result.current.data?.current).toBe(1);
  });

  it("sets error when request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 } as any));

    const { result } = renderHook(() => useStreak("abc"));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

