import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DiffTrendChart from "../../src/components/DiffTrendChart";

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const trend = {
  repos: ["dev/app", "acme/api"],
  weeks: [
    { weekStart: "2026-11-01", additions: 1200, deletions: 300 },
    { weekStart: "2026-11-08", additions: 300, deletions: 100 },
  ],
};

describe("DiffTrendChart", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows totals and the repositories counted", async () => {
    fetchMock.mockReturnValue(reply(200, trend));
    render(<DiffTrendChart />);

    expect(await screen.findByText("+1.5K")).toBeInTheDocument();
    expect(screen.getByText("−400")).toBeInTheDocument();
    expect(screen.getByText("+1.1K")).toBeInTheDocument();
    expect(
      screen.getByText(/per week in dev\/app, acme\/api, last 12 weeks/)
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/metrics/diff-trend");
  });

  it("waits for GitHub to compute stats until the user checks again", async () => {
    fetchMock
      .mockReturnValueOnce(reply(202, { computing: true }))
      .mockReturnValueOnce(reply(200, trend));
    render(<DiffTrendChart />);

    expect(await screen.findByText(/Computing stats/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    expect(await screen.findByText("+1.5K")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("explains a rate limit and offers a retry", async () => {
    fetchMock.mockReturnValue(reply(429, { error: "rate limited" }));
    render(<DiffTrendChart />);

    expect(
      await screen.findByText(/GitHub is rate limiting your account/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("shows an empty state when no lines changed", async () => {
    fetchMock.mockReturnValue(
      reply(200, {
        repos: [],
        weeks: [{ weekStart: "2026-11-08", additions: 0, deletions: 0 }],
      })
    );
    render(<DiffTrendChart />);

    expect(
      await screen.findByText("No line changes in the last 12 weeks.")
    ).toBeInTheDocument();
  });
});
