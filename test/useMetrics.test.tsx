import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderHook, act } from "@testing-library/react";

import { useMetrics } from "../src/hooks/useMetrics";

describe("useMetrics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sets data after successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ foo: "bar" }),
    } as any));

    const { result } = renderHook(() => useMetrics());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.data).toEqual({ foo: "bar" });
  });

  it("sets error on failed fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any));

    const { result } = renderHook(() => useMetrics());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("refetch updates data on subsequent call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ v: 1 }) } as any)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ v: 2 }) } as any);

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMetrics());

    // Wait for initial mount fetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.data).toEqual({ v: 1 });

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({ v: 2 });
  });
});

