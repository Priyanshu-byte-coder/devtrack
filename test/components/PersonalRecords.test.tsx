import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import PersonalRecords from "../../src/components/PersonalRecords";

// Mock the context and canvas-confetti
vi.mock("@/components/AccountContext", () => ({
  useAccount: () => ({ selectedAccount: "test-account" }),
}));

const mockConfetti = vi.fn();
vi.mock("canvas-confetti", () => ({
  default: (...args: any[]) => mockConfetti(...args),
}));

describe("PersonalRecords Confetti", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockConfetti.mockClear();

    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/metrics/streak")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ longest: 5, current: 2, lastCommitDate: null, totalActiveDays: 10 }),
        });
      }
      if (url.includes("/api/metrics/contributions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ days: 365, total: 100, data: { "2026-06-01": 10 } }),
        });
      }
      if (url.includes("/api/metrics/repos")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ repos: [{ name: "owner/repo", commits: 20, url: "http://github" }] }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    }) as any;

    // Mock matchMedia for prefers-reduced-motion
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not trigger confetti on the first session load", async () => {
    render(<PersonalRecords />);

    // Wait for the records to load by checking for a record label
    await waitFor(() => {
      expect(screen.getByText("Longest Streak")).toBeInTheDocument();
      // Check that sessionStorage is initialized with the records
      expect(sessionStorage.getItem("devtrack_records_test-account_longest_streak")).toBe("5");
      expect(sessionStorage.getItem("devtrack_records_test-account_best_day")).toBe("10");
    });

    // Confetti should not be called on the initial load of the session
    expect(mockConfetti).not.toHaveBeenCalled();
  });

  it("triggers confetti when a record improves during the session", async () => {
    // 1. Initialize the session storage with lower records
    sessionStorage.setItem("devtrack_records_test-account_longest_streak", "3");
    sessionStorage.setItem("devtrack_records_test-account_best_day", "8");

    render(<PersonalRecords />);

    await waitFor(() => {
      expect(screen.getByText("Longest Streak")).toBeInTheDocument();
      // Since 5 > 3 (longest streak) and 10 > 8 (best day), it should trigger confetti and update storage
      expect(sessionStorage.getItem("devtrack_records_test-account_longest_streak")).toBe("5");
      expect(sessionStorage.getItem("devtrack_records_test-account_best_day")).toBe("10");
      expect(mockConfetti).toHaveBeenCalledTimes(1);
    });
  });

  it("does not trigger confetti if records are equal or lower", async () => {
    // 1. Initialize the session storage with equal or higher records
    sessionStorage.setItem("devtrack_records_test-account_longest_streak", "5");
    sessionStorage.setItem("devtrack_records_test-account_best_day", "12");

    render(<PersonalRecords />);

    await waitFor(() => {
      expect(screen.getByText("Longest Streak")).toBeInTheDocument();
      // Should sync the lower best_day to sessionStorage without triggering confetti
      expect(sessionStorage.getItem("devtrack_records_test-account_best_day")).toBe("10");
      expect(mockConfetti).not.toHaveBeenCalled();
    });
  });

  it("respects prefers-reduced-motion media query", async () => {
    // 1. Set prefers-reduced-motion to true
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // 2. Set lower records to try to trigger confetti
    sessionStorage.setItem("devtrack_records_test-account_longest_streak", "3");

    render(<PersonalRecords />);

    await waitFor(() => {
      expect(screen.getByText("Longest Streak")).toBeInTheDocument();
      // Storage is updated
      expect(sessionStorage.getItem("devtrack_records_test-account_longest_streak")).toBe("5");
      // Confetti is suppressed due to prefers-reduced-motion
      expect(mockConfetti).not.toHaveBeenCalled();
    });
  });
});
