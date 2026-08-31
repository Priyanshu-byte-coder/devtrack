import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderHook, act } from "@testing-library/react";

import { useNotifications } from "../src/hooks/useNotifications";

describe("useNotifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sets notifications data on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        notifications: [{ id: "1", type: "x", message: "hello", read: false, created_at: "2020-01-01" }],
        unreadCount: 1,
      }),
    } as any));

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.data?.unreadCount).toBe(1);
    expect(result.current.data?.notifications).toHaveLength(1);
  });

  it("normalizes malformed payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ notifications: null, unreadCount: "nope" }),
    } as any));

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBe(null);
    expect(result.current.data?.notifications).toEqual([]);
    expect(result.current.data?.unreadCount).toBe(0);
  });

  it("sets error on failed fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 } as any));

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

