import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import StreakAtRiskBanner from "../../src/components/StreakAtRiskBanner";

const createStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
};

describe("StreakAtRiskBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T21:00:00"));

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorage(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const renderBanner = (
    lastCommitDate: string | null = "2026-11-24",
    currentStreak = 5,
    hasStreakFreeze = false
  ) =>
    render(
      <StreakAtRiskBanner
        lastCommitDate={lastCommitDate}
        currentStreak={currentStreak}
        hasStreakFreeze={hasStreakFreeze}
      />
    );

  it("shows the banner after 8 PM when no commit was made today", () => {
    renderBanner();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not show the banner before 8 PM", () => {
    vi.setSystemTime(new Date("2026-11-25T19:59:00"));
    renderBanner();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show the banner when the last commit was today", () => {
    renderBanner("2026-11-25");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show the banner when a streak freeze is active", () => {
    renderBanner("2026-11-24", 5, true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show the banner when the current streak is zero", () => {
    renderBanner("2026-11-24", 0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("persists dismissal for the rest of the day", () => {
    const { unmount } = renderBanner();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss banner" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("streak-banner-dismissed-date")).toBe(
      "2026-11-25"
    );

    unmount();
    renderBanner();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("allows the banner to appear again on the next day", () => {
    window.localStorage.setItem("streak-banner-dismissed-date", "2026-11-24");

    renderBanner();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not crash when localStorage reads fail", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    renderBanner();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("still dismisses the banner when localStorage writes fail", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    renderBanner();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss banner" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
