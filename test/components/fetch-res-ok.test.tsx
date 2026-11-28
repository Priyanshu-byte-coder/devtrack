import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import TopRepos from "@/components/TopRepos";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("fetch response.ok checks (Issue #3888)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the error state in TopRepos when /api/metrics/repos returns !res.ok", async () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
    };
    Object.defineProperty(globalThis, "localStorage", { value: mockStorage, configurable: true });
    Object.defineProperty(window, "localStorage", { value: mockStorage, configurable: true });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/metrics/repos?")) {
        return new Response(JSON.stringify({ repos: [], error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ pinned_repos: [], repos: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    render(<TopRepos />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "We couldn't load your top repositories right now. Please try again in a moment."
        )
      ).toBeTruthy();
    });
  });
});
