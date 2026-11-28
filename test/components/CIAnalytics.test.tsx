import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import CIAnalytics from "../../src/components/CIAnalytics";

vi.mock("@/components/AccountContext", () => ({
  useAccount: () => ({ selectedAccount: null }),
}));

const ciData = {
  successRate: 95,
  averageDurationMinutes: 3,
  flakiestWorkflow: null,
  totalRuns: 42,
  reposChecked: 5,
};

describe("CIAnalytics - Issue analytics match (#3878)", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/metrics/ci")) {
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: () => null },
          json: () => Promise.resolve(ciData),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    }) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the four stat tiles with their values", async () => {
    render(<CIAnalytics />);
    await waitFor(() => expect(screen.getByText("Success Rate")).toBeVisible());
    expect(screen.getByText("95%")).toBeVisible();
    expect(screen.getByText("3m")).toBeVisible();
    expect(screen.getByText("42")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
  });

  it("uses a square Refresh button", async () => {
    render(<CIAnalytics />);
    const refresh = await screen.findByRole("button", { name: "Refresh" });
    expect(refresh.className).not.toContain("rounded-md");
  });

  it("lays the stat tiles out like Issue analytics (2 cols, 4 on sm+)", async () => {
    const { container } = render(<CIAnalytics />);
    await waitFor(() => expect(screen.getByText("Success Rate")).toBeVisible());
    const grid = container.querySelector(".grid.grid-cols-2.gap-3.sm\\:grid-cols-4");
    expect(grid).not.toBeNull();
  });

  it("gives each stat tile its own colour key", async () => {
    const { container } = render(<CIAnalytics />);
    await waitFor(() => expect(screen.getByText("Success Rate")).toBeVisible());
    const cells = container.querySelectorAll(".stat-cell");
    expect(cells.length).toBeGreaterThanOrEqual(4);
    const colours = Array.from(cells)
      .slice(0, 4)
      .map((cell) => (cell as HTMLElement).style.getPropertyValue("--stat-c"));
    expect(new Set(colours).size).toBe(4);
    expect(colours).toContain("#34d399");
    expect(colours).toContain("#6ba8ff");
    expect(colours).toContain("#fb923c");
    expect(colours).toContain("#c77dff");
  });
});
